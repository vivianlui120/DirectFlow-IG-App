/**
 * Core 自动回复调度器
 * 后台定时轮询各账号收件匣，匹配关键字并自动回复
 * 与群发任务错开执行，避免账号风控
 */
const igDriver = require('../ig-driver');
const db = require('./db');
const dmDispatcher = require('./dm-dispatcher');

// 调度器状态
const schedulerState = {
  running: false,
  timer: null,
  currentAccount: null,
  lastCheckAt: null,
  totalReplied: 0,
  logs: [],
  onLog: null, // 日志回调
};

/**
 * 添加日志
 */
function addLog(account, msg, type = 'info') {
  const log = { time: new Date().toISOString(), account, msg, type };
  schedulerState.logs.unshift(log);
  if (schedulerState.logs.length > 200) schedulerState.logs.pop();
  if (schedulerState.onLog) schedulerState.onLog(log);
}

/**
 * 处理单个账号的收件匣扫描
 */
async function processAccount(account) {
  schedulerState.currentAccount = account.username;

  try {
    // 启动浏览器（使用账号的代理和指纹）
    const settings = db.getSettings();
    await igDriver.launch({
      accountId: account.id,
      proxyHost: account.proxyHost || settings.proxy.defaultHost,
      proxyPort: account.proxyPort || settings.proxy.defaultPort,
      proxyUser: account.proxyUser || settings.proxy.defaultUser,
      proxyPass: account.proxyPass || settings.proxy.defaultPass,
      fingerprint: account.fingerprint,
      headless: true,
    });

    // 获取启用的规则
    const rules = db.getAutoReplyRules(true);

    // 检查收件匣并回复
    const stats = await igDriver.checkInboxAndReply(
      account,
      rules,
      (accId, sender) => db.shouldSkipAutoReply(accId, sender),
      (logData) => {
        // 记录回复日志
        db.addAutoReplyLog(logData);
        schedulerState.totalReplied++;
        addLog(account.username, `→ 自动回复 ${logData.sender_username}: 「${logData.received_message.substring(0, 20)}」→ 「${logData.sent_reply.substring(0, 20)}」`, 'ok');
      }
    );

    addLog(account.username, `扫描完成：未读${stats.checked}条，回复${stats.replied}条，跳过${stats.skipped}条，错误${stats.errors}条`, 'info');

    // 关闭浏览器
    await igDriver.close(account.id);

  } catch (e) {
    addLog(account.username, `扫描异常: ${e.message}`, 'error');
    try { await igDriver.close(account.id); } catch (e2) {}
  }

  schedulerState.currentAccount = null;
}

/**
 * 执行一轮完整扫描
 */
async function runScanCycle() {
  if (schedulerState.running) return; // 防止重叠
  schedulerState.running = true;

  try {
    const arSettings = db.getAutoReplySettings();
    const accounts = db.getAccounts().filter(a =>
      a.enabled !== false &&
      a.status !== 'banned' &&
      arSettings.accountEnabled[a.id] !== false
    );

    if (accounts.length === 0) {
      addLog('系统', '没有启用自动回复的账号', 'warn');
      schedulerState.running = false;
      return;
    }

    addLog('系统', `开始轮询，共${accounts.length}个账号`, 'info');

    for (const account of accounts) {
      // 检查群发任务是否在运行，如果在运行则跳过本轮（错开执行）
      const dmStatus = dmDispatcher.getMassDMStatus();
      if (dmStatus.running) {
        addLog('系统', '群发任务运行中，自动回复暂停等待', 'warn');
        break;
      }

      await processAccount(account);

      // 账号之间间隔，避免风控
      await new Promise(r => setTimeout(r, 10000 + Math.random() * 10000));
    }

    schedulerState.lastCheckAt = new Date().toISOString();
    addLog('系统', '本轮轮询完成', 'info');

  } catch (e) {
    addLog('系统', `轮询异常: ${e.message}`, 'error');
  }

  schedulerState.running = false;
}

/**
 * 启动自动回复调度器
 * @param {Object} options
 * @param {number} options.intervalMinutes - 轮询间隔（分钟）
 * @param {Function} options.onLog - 日志回调
 */
function startAutoReply(options = {}) {
  const arSettings = db.getAutoReplySettings();
  const intervalMinutes = options.intervalMinutes || arSettings.intervalMinutes || 5;

  if (schedulerState.timer) {
    clearInterval(schedulerState.timer);
  }

  schedulerState.onLog = options.onLog || null;
  schedulerState.running = false;

  // 保存设置
  db.saveAutoReplySettings({ ...arSettings, enabled: true, intervalMinutes });

  // 立即执行一轮
  runScanCycle();

  // 定时轮询
  schedulerState.timer = setInterval(() => {
    if (!schedulerState.running) {
      runScanCycle();
    }
  }, intervalMinutes * 60 * 1000);

  addLog('系统', `自动回复已启动，每${intervalMinutes}分钟轮询一次`, 'ok');
  return { success: true, intervalMinutes };
}

/**
 * 停止自动回复调度器
 */
function stopAutoReply() {
  if (schedulerState.timer) {
    clearInterval(schedulerState.timer);
    schedulerState.timer = null;
  }
  schedulerState.running = false;

  const arSettings = db.getAutoReplySettings();
  db.saveAutoReplySettings({ ...arSettings, enabled: false });

  addLog('系统', '自动回复已停止', 'warn');
  return { success: true };
}

/**
 * 获取调度器状态
 */
function getStatus() {
  const arSettings = db.getAutoReplySettings();
  return {
    running: schedulerState.timer !== null,
    currentAccount: schedulerState.currentAccount,
    lastCheckAt: schedulerState.lastCheckAt,
    totalReplied: schedulerState.totalReplied,
    intervalMinutes: arSettings.intervalMinutes,
    enabled: arSettings.enabled,
    accountEnabled: arSettings.accountEnabled,
    logs: schedulerState.logs.slice(0, 50),
  };
}

/**
 * 手动触发一次扫描（不启动定时器）
 */
async function triggerManualScan() {
  if (schedulerState.running) {
    return { success: false, error: '已有扫描任务在运行' };
  }
  await runScanCycle();
  return { success: true };
}

module.exports = {
  startAutoReply,
  stopAutoReply,
  getStatus,
  triggerManualScan,
};
