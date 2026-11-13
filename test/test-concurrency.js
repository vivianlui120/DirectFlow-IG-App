/**
 * 并发自适应模块测试（不依赖 Electron、不依赖数据库）
 * 运行：node test/test-concurrency.js
 */
const os = require('os');
const c = require('../src/core/concurrency');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log('PASS  ' + name + (extra ? '  ' + extra : ''));
  } else {
    failures++;
    console.log('FAIL  ' + name + (extra ? '  ' + extra : ''));
  }
}

(async () => {
  console.log('=== 1. 硬件识别 ===');
  const hw = c.detectHardware();
  console.log(`cores=${hw.cores} totalMB=${hw.totalMB} freeMB=${hw.freeMB}`);
  check('核数与总内存读取有效', hw.cores >= 1 && hw.totalMB > 0);

  console.log('\n=== 2. 自动并发计算 ===');
  const auto = c.resolveConcurrency();
  console.log('value=' + auto.value + ' suggested=' + auto.suggested +
    ' memSlots=' + auto.memSlots + ' cpuSlots=' + auto.cpuSlots + ' cap=' + auto.cap);
  console.log(c.describe(auto));
  check('并发数至少为1', auto.value >= 1);
  check('并发数不超过机型上限', auto.value <= auto.cap);
  check('并发数不超过核数方案', auto.value <= Math.max(1, auto.cpuSlots));
  check('并发数不超过内存方案(空余足够时)', auto.usableMB < auto.perBrowserMB ? auto.value === 1 : auto.value <= Math.max(1, auto.memSlots));

  console.log('\n=== 3. 手动覆盖与上限校正 ===');
  const high = c.resolveConcurrency({ max: 99 });
  check('超大手设被压到机型上限', high.value === high.cap, `value=${high.value} cap=${high.cap}`);
  const low = c.resolveConcurrency({ max: 1 });
  check('手动设为1生效', low.value === 1 && low.source === 'manual');
  const zero = c.resolveConcurrency({ max: 0 });
  check('非法值0回退为自动', zero.source === 'auto' && zero.value === auto.value);

  console.log('\n=== 4. 并发池：同时运行数不超限 ===');
  let inFlight = 0, peak = 0, done = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);
  const res = await c.runPool(items, 3, async (item) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await c.sleep(120);
    inFlight--;
    done++;
    return item * 2;
  });
  check('全部任务都处理完', done === 12, `done=${done}`);
  check('峰值并发不超过3', peak <= 3, `peak=${peak}`);
  check('结果顺序与输入一致', res.length === 12 && res[0] === 0 && res[11] === 22);
  check('并发确实被利用(峰值>=2)', peak >= 2, `peak=${peak}`);

  console.log('\n=== 5. 并发池：停止信号 ===');
  let processed = 0;
  let stopFlag = false;
  await c.runPool(Array.from({ length: 20 }, (_, i) => i), 2, async () => {
    processed++;
    if (processed >= 4) stopFlag = true;
    await c.sleep(50);
  }, { isStopped: () => stopFlag });
  check('停止后不再领取新任务', processed <= 6, `processed=${processed}`);

  console.log('\n=== 6. 并发池：启动错峰 ===');
  const starts = [];
  await c.runPool([0, 1, 2, 3], 4, async () => {
    starts.push(Date.now());
    await c.sleep(10);
  }, { startGapMs: 100 });
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  console.log('启动间隔(ms): ' + gaps.join(', '));
  check('相邻启动间隔不小于95ms', gaps.every(g => g >= 95), `gaps=${gaps.join(',')}`);

  console.log('\n=== 7. 边界：空列表 ===');
  const empty = await c.runPool([], 4, async () => 1);
  check('空列表返回空数组', Array.isArray(empty) && empty.length === 0);

  console.log('\n=== 8. 边界：limit 大于任务数 ===');
  let peak2 = 0, flight2 = 0;
  await c.runPool([0, 1], 8, async () => {
    flight2++; peak2 = Math.max(peak2, flight2);
    await c.sleep(60);
    flight2--;
  });
  check('limit 大于任务数时峰值不超过任务数', peak2 <= 2, `peak=${peak2}`);

  console.log('\n' + (failures === 0 ? '全部通过' : `失败 ${failures} 项`));
  process.exit(failures === 0 ? 0 : 1);
})();
