/**
 * 并发池集成测试（模块级）
 * 用替身模块加载真实的 dm-dispatcher / warmup-scheduler，
 * 验证真实调用路径下"同时打开的浏览器数量"不超过自算上限。
 *
 * 不依赖 Electron、不依赖 Supabase、不依赖真实浏览器。
 * 运行：node test/test-pool-integration.js
 */
const Module = require('module');

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log('PASS  ' + name + (extra ? '  ' + extra : ''));
  else { failures++; console.log('FAIL  ' + name + (extra ? '  ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- 替身状态 ----------
let activeBrowsers = 0;
let peakBrowsers = 0;
function resetTrack() { activeBrowsers = 0; peakBrowsers = 0; }
function trackLaunch() {
  activeBrowsers++;
  peakBrowsers = Math.max(peakBrowsers, activeBrowsers);
}

const accounts = Array.from({ length: 6 }, (_, i) => ({
  id: 'acc' + i,
  username: 'user' + i,
  status: 'active',
  enabled: true,
  password: 'pwd',
  twofaSecret: '',
  proxyHost: '127.0.0.1',
  proxyPort: 1080,
  fingerprint: null,
}));

const dbSpecific = {
  getAccounts: () => accounts,
  getAccount: (id) => accounts.find(a => a.id === id),
  getLeads: () => Array.from({ length: 12 }, (_, i) => ({ id: 'lead' + i, username: 'target' + i })),
  getTemplates: () => [{ id: 't1', content: '你好 {username}', images: [] }],
  shouldSkipByDedupRule: () => false,
  getTodaySentCount: () => 0,
  getWarmupPlan: () => ({ plan: 'standard', planName: '标准养号', durationMin: 1 }),
  getManualStrategy: () => ({ plan: 'standard', planName: '标准养号', durationMin: 1 }),
  calculateHealthScore: () => 80,
};
const noop = () => undefined;
const dbStub = new Proxy(dbSpecific, {
  get(target, prop) { return prop in target ? target[prop] : noop; },
});

const igStub = {
  launch: async () => { trackLaunch(); await sleep(50); return {}; },
  close: async () => { activeBrowsers = Math.max(0, activeBrowsers - 1); },
  isLoggedIn: async () => true,
  login: async () => ({ success: true }),
  sendDM: async () => { await sleep(30); return { success: true }; },
  cooldownAfterSend: async () => 0,
  startWarmupSession: async () => {
    await sleep(60);
    return {
      liked: 5, storiesWatched: 3, feedViewed: 2, exploreScrolled: 1,
      durationSec: 60, warnings: [], pauses: 1, feedScrolled: 2,
    };
  },
};

// ---------- 拦截依赖 ----------
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === './db') return dbStub;
  if (request === '../ig-driver') return igStub;
  return origLoad.apply(this, arguments);
};

async function waitUntil(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return true;
    await sleep(50);
  }
  console.log('TIMEOUT  ' + label);
  return false;
}

(async () => {
  const dm = require('../src/core/dm-dispatcher');
  const ws = require('../src/core/warmup-scheduler');
  const conc = require('../src/core/concurrency');

  console.log('=== A. 私信群发：并发上限生效 ===');
  resetTrack();
  const dmRes = await dm.startMassDM({
    accountIds: accounts.map(a => a.id),
    templateIds: [],
    dedupRule: 'off',
    startGapMs: 0, // 测试时取消启动间隔
  });
  check('任务启动返回成功', dmRes.success === true);
  check('返回并发数', typeof dmRes.concurrency === 'number', 'concurrency=' + dmRes.concurrency);
  const startLogs = dm.getMassDMStatus().logs.map(l => String(l.msg));
  check('启动时会写入并发策略日志', startLogs.some(m => m.includes('并发策略')), startLogs[0] || '');

  const finished = await waitUntil(() => !dm.getMassDMStatus().running, 15000, '群发未在15秒内结束');
  check('群发任务在限定时间内结束', finished);

  const st = dm.getMassDMStatus();
  const limit = st.concurrency ? st.concurrency.value : dmRes.concurrency;
  check('峰值浏览器数不超过自算并发', peakBrowsers <= limit, `peak=${peakBrowsers} limit=${limit}`);
  check('并发确实被利用', peakBrowsers >= Math.min(2, limit), `peak=${peakBrowsers}`);
  check('全部12条名单发送成功', st.total.success === 12, 'success=' + st.total.success);
  check('结束后没有残留浏览器实例', activeBrowsers === 0, 'active=' + activeBrowsers);
  check('进度对象带并发明细', !!st.concurrency && typeof st.concurrency.summary === 'string');

  console.log('\n=== B. 批量养号：并发上限生效 ===');
  resetTrack();
  const wsRes = await ws.startBatchWarmup({ mode: 'auto', startGapMs: 0 });
  check('批量养号启动返回成功', wsRes.success === true);
  check('返回账号数与并发数', wsRes.accountCount === 6 && typeof wsRes.concurrency === 'number',
    `count=${wsRes.accountCount} conc=${wsRes.concurrency}`);

  const wsDone = await waitUntil(() => !ws.getStatus().running, 15000, '养号未在15秒内结束');
  check('批量养号在限定时间内结束', wsDone);
  check('峰值浏览器数不超过自算并发', peakBrowsers <= wsRes.concurrency, `peak=${peakBrowsers} limit=${wsRes.concurrency}`);
  check('6个账号都有统计结果', Object.keys(ws.getStatus().accountStats).length === 6);
  check('结束后没有残留浏览器实例', activeBrowsers === 0, 'active=' + activeBrowsers);
  check('并发明细写入了状态', !!ws.getStatus().concurrency && ws.getStatus().concurrency.value >= 1);

  console.log('\n=== C. 停止信号：不再补位 ===');
  resetTrack();
  dm.startMassDM({ accountIds: accounts.map(a => a.id), templateIds: [], dedupRule: 'off', startGapMs: 0 });
  await sleep(120);
  dm.stopMassDM();
  const stopped = await waitUntil(() => !dm.getMassDMStatus().running, 8000, '停止后未结束');
  check('停止后任务能收尾', stopped);
  check('停止后浏览器全部关闭', activeBrowsers === 0, 'active=' + activeBrowsers);

  console.log('\n本机建议并发：' + conc.resolveConcurrency().value);
  console.log(failures === 0 ? '全部通过' : `失败 ${failures} 项`);
  process.exit(failures === 0 ? 0 : 1);
})();
