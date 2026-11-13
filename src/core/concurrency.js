/**
 * Core 并发自适应模块
 * 依据本机内存与 CPU 核数，计算"同时开启浏览器实例"的安全上限
 *
 * 设计原则：
 * 1. 宁可少开，不要开满：单个 headless 浏览器（含 IG 页面）按 600MB 规划
 * 2. 给系统与主进程留出余量：预留 max(1.5GB, 总内存20%)
 * 3. 核数只允许用一半：浏览器是 IO 型，但要给 Electron 主进程和其他功能留 CPU
 * 4. 内存、核数、机型上限三者取最小
 *
 * 支持手动覆盖：resolveConcurrency({ max }) 或环境变量 IGDM_MAX_CONCURRENCY
 */
const os = require('os');

const DEFAULT_PER_BROWSER_MB = 600;   // 单个浏览器实例规划占用（headless Chrome 实测区间 400-700MB）
const DEFAULT_RESERVE_MB = 1536;      // 至少给系统留 1.5GB
const RESERVE_RATIO = 0.20;           // 或总内存 20%，取较大者

/**
 * 机型分级上限（按总内存）
 */
function capByTotalMB(totalMB) {
  if (totalMB >= 32768) return 12;   // 32GB 以上
  if (totalMB >= 16384) return 8;    // 16-32GB
  if (totalMB >= 8192) return 6;     // 8-16GB
  return 3;                          // 8GB 以下
}

/**
 * 读取本机硬件信息
 */
function detectHardware() {
  const cores = (os.cpus() || []).length || 1;
  const totalMB = Math.round(os.totalmem() / (1024 * 1024));
  const freeMB = Math.round(os.freemem() / (1024 * 1024));
  return {
    cores,
    totalMB,
    freeMB,
    platform: os.platform(),
    arch: os.arch(),
  };
}

/**
 * 计算建议并发数
 * @param {Object} options
 * @param {number} options.max - 手动指定并发数（会按机型上限校正）
 * @param {number} options.perBrowserMB - 单实例内存预算
 * @param {number} options.reserveMB - 系统预留
 * @returns {Object} 并发决策明细
 */
function resolveConcurrency(options = {}) {
  const hw = detectHardware();
  const perBrowserMB = Number(options.perBrowserMB) > 0
    ? Number(options.perBrowserMB)
    : DEFAULT_PER_BROWSER_MB;

  const reserveMB = Math.max(
    Number(options.reserveMB) > 0 ? Number(options.reserveMB) : DEFAULT_RESERVE_MB,
    Math.round(hw.totalMB * RESERVE_RATIO)
  );

  const cap = capByTotalMB(hw.totalMB);
  const usableMB = Math.max(0, hw.freeMB - reserveMB);

  const memSlots = Math.floor(usableMB / perBrowserMB);
  const cpuSlots = Math.max(1, Math.floor(hw.cores / 2));

  // 自动建议值：三者取最小，且不低于 1
  let suggested = Math.min(memSlots, cpuSlots, cap);
  if (!isFinite(suggested) || suggested < 1) suggested = 1;
  suggested = Math.max(1, Math.floor(suggested));

  // 手动覆盖：环境变量优先于参数之外，二者都受机型上限约束
  const envMax = parseInt(process.env.IGDM_MAX_CONCURRENCY, 10);
  const manual = Number(options.max) > 0
    ? Math.floor(Number(options.max))
    : (isFinite(envMax) && envMax > 0 ? envMax : null);

  let value = suggested;
  let source = 'auto';
  if (manual !== null) {
    value = Math.max(1, Math.min(manual, cap));
    source = 'manual';
  }

  return {
    value,
    source,
    suggested,
    manual,
    cores: hw.cores,
    totalMB: hw.totalMB,
    freeMB: hw.freeMB,
    reserveMB,
    usableMB,
    perBrowserMB,
    memSlots,
    cpuSlots,
    cap,
    platform: hw.platform,
  };
}

/**
 * 把决策明细翻译成一句中文，便于写进日志和界面
 */
function describe(c) {
  const gb = mb => (mb / 1024).toFixed(1);
  const base = `本机 ${c.cores} 核 / ${gb(c.totalMB)}GB 内存，空闲 ${gb(c.freeMB)}GB；` +
    `按每实例 ${c.perBrowserMB}MB、系统预留 ${gb(c.reserveMB)}GB 计算，` +
    `内存可容 ${Math.max(0, c.memSlots)} 个、核数可容 ${c.cpuSlots} 个、机型上限 ${c.cap} 个，` +
    `建议同时开启 ${c.suggested} 个浏览器`;
  if (c.source === 'manual') {
    return base + `；已按手动设置取 ${c.value} 个（不低于 1、不超过机型上限 ${c.cap}）`;
  }
  return base + `；本次按 ${c.value} 个执行`;
}

/**
 * 简单等待
 */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 通用并发池：把 items 分给最多 limit 个 worker 同时处理
 * 一个处理完立刻补位，保证"同时运行的浏览器数量"始终不超过 limit
 *
 * @param {Array} items
 * @param {number} limit - 最大并发
 * @param {Function} handler - async (item, index) => any
 * @param {Object} options
 * @param {Function} options.isStopped - 返回 true 时不再领取新任务
 * @param {number} options.startGapMs - 两次任务开始之间的最小间隔（防风控、防同时拉起）
 * @returns {Promise<Array>} 各 item 的处理结果
 */
async function runPool(items, limit, handler, options = {}) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];

  const size = Math.max(1, Math.min(Math.floor(Number(limit) || 1), list.length));
  const isStopped = typeof options.isStopped === 'function' ? options.isStopped : () => false;
  const gapMs = Math.max(0, Number(options.startGapMs) || 0);
  const results = new Array(list.length);
  let nextIndex = 0;
  let nextStartAt = 0;

  async function waitStartGap() {
    if (!gapMs) return;
    const now = Date.now();
    const at = Math.max(now, nextStartAt);
    nextStartAt = at + gapMs;
    if (at > now) await sleep(at - now);
  }

  async function worker() {
    while (true) {
      if (isStopped()) return;
      const index = nextIndex++;
      if (index >= list.length) return;
      await waitStartGap();
      if (isStopped()) return;
      results[index] = await handler(list[index], index);
    }
  }

  const workers = [];
  for (let i = 0; i < size; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

/**
 * 当前正在运行的浏览器数量（供状态展示）
 */
function snapshot(c) {
  return {
    value: c.value,
    suggested: c.suggested,
    source: c.source,
    cores: c.cores,
    totalMB: c.totalMB,
    freeMB: c.freeMB,
    summary: describe(c),
  };
}

module.exports = {
  detectHardware,
  resolveConcurrency,
  describe,
  runPool,
  snapshot,
  sleep,
  DEFAULT_PER_BROWSER_MB,
};
