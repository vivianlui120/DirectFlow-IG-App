/**
 * Core 养号排程器
 * 负责任务调度、定时养号、策略选择、状态实时推送
 * 不包含任何 Puppeteer 操作，通过 ig-driver 驱动层执行
 */
const igDriver = require('../ig-driver');
const db = require('./db');

// 排程器状态
const schedulerState = {
  running: false,
  paused: false,
  stopped: false,
  scheduleTimer: null,
  dailyTimer: null,
  scheduledTime: '09:00', // 默认每天9点
  scheduledDuration: 15,   // 默认15分钟
  currentAccount: null,
  accountStats: {},
  logs: [],
  onStatusUpdate: null,    // 状态推送回调
};

/**
 * 添加日志并推送状态
 */
function addLog(account, msg, type = 'info') {
  const log = { time: new Date().toISOString(), account, msg, type };
  schedulerState.logs.unshift(log);
  if (schedulerState.logs.length > 200) schedulerState.logs.pop();
  if (schedulerState.onStatusUpdate) {
    schedulerState.onStatusUpdate(getStatus());
  }
}

/**
 * 获取当前状态
 */
function getStatus() {
  return {
    running: schedulerState.running,
    paused: schedulerState.paused,
    currentAccount: schedulerState.currentAccount,
    scheduledTime: schedulerState.scheduledTime,
    scheduledDuration: schedulerState.scheduledDuration,
    accountStats: { ...schedulerState.accountStats },
    logs: schedulerState.logs.slice(0, 50),
  };
}

/**
 * 执行单个账号的养号
 * @param {Object} account - 账号对象
 * @param {Object} strategy - 养号策略
 */
async function runAccountWarmup(account, strategy) {
  const accountId = account.id;
  schedulerState.accountStats[accountId] = {
    username: account.username,
    status: 'running',
    liked: 0,
    stories: 0,
    feedViews: 0,
    durationSec: 0,
    warnings: [],
  };

  addLog(account.username, `开始养号 [${strategy.planName}]，预计${strategy.durationMin}分钟`);

  // 启动浏览器（headless静默）
  try {
    await igDriver.launch({
      accountId,
      proxyHost: account.proxyHost,
      proxyPort: account.proxyPort,
      proxyUser: account.proxyUser,
      proxyPass: account.proxyPass,
      fingerprint: account.fingerprint,
      headless: true,
    });
    addLog(account.username, '浏览器实例已启动（静默模式）');
  } catch (e) {
    addLog(account.username, `浏览器启动失败: ${e.message}`, 'error');
    schedulerState.accountStats[accountId].status = 'failed';
    return;
  }

  // 检测登录
  try {
    const loggedIn = await igDriver.isLoggedIn(accountId);
    if (!loggedIn) {
      if (account.username && account.password) {
        addLog(account.username, '未登录，尝试自动登录...');
        const loginResult = await igDriver.login(accountId, account.username, account.password, account.twofaSecret);
        if (!loginResult.success) {
          addLog(account.username, `登录失败: ${loginResult.error || '未知'}`, 'error');
          schedulerState.accountStats[accountId].status = 'login_failed';
          await igDriver.close(accountId);
          return;
        }
        addLog(account.username, '登录成功');
      } else {
        addLog(account.username, '未配置账号密码，跳过', 'warn');
        schedulerState.accountStats[accountId].status = 'no_credentials';
        await igDriver.close(accountId);
        return;
      }
    } else {
      addLog(account.username, '已有登录态');
    }
  } catch (e) {
    addLog(account.username, `登录检测异常: ${e.message}`, 'error');
  }

  db.updateAccount(accountId, { warmup_status: 'running', status: 'warming' });

  // 合并账号的地区偏好设置
  strategy.region = account.warmupRegion || 'random';
  strategy.enableRegionTags = true;
  strategy.regionTagCount = 3;
  addLog(account.username, `养号地区偏好: ${strategy.region === 'random' ? '随机国家' : strategy.region}`);

  // 执行养号 Session
  try {
    const stats = await igDriver.startWarmupSession(accountId, strategy);
    schedulerState.accountStats[accountId] = {
      ...schedulerState.accountStats[accountId],
      status: 'completed',
      liked: stats.liked,
      stories: stats.storiesWatched,
      feedViews: stats.feedViewed + stats.exploreScrolled,
      durationSec: stats.durationSec,
      warnings: stats.warnings,
    };

    // 记录养号日志
    db.addWarmupSessionLog({
      accountId,
      username: account.username,
      strategy: strategy.plan,
      strategyName: strategy.planName,
      durationSec: stats.durationSec,
      liked: stats.liked,
      storiesWatched: stats.storiesWatched,
      feedScrolled: stats.feedScrolled + stats.exploreScrolled,
      pauses: stats.pauses,
      warnings: stats.warnings,
      endedAt: new Date().toISOString(),
    });

    // 更新账号数据
    const newHealth = db.calculateHealthScore({
      ...account,
      warmup_days: (account.warmup_days || 0) + 1,
      last_warmup_at: new Date().toISOString(),
    });

    // 检查是否跨天，增加养号天数
    const today = new Date().toDateString();
    const lastWarmupDay = account.last_warmup_at ? new Date(account.last_warmup_at).toDateString() : null;
    const newDays = lastWarmupDay !== today ? (account.warmup_days || 0) + 1 : (account.warmup_days || 0);

    db.updateAccount(accountId, {
      warmup_status: 'completed',
      status: 'active',
      warmup_days: newDays,
      health_score: newHealth,
      last_warmup_at: new Date().toISOString(),
      today_warmup_done: true,
      totalLikes: (account.totalLikes || 0) + stats.liked,
      totalStories: (account.totalStories || 0) + stats.storiesWatched,
      totalFeedViews: (account.totalFeedViews || 0) + stats.feedViewed,
      warmupLevel: Math.min(10, Math.floor(newDays / 2)),
    });

    addLog(account.username, `养号完成！点赞${stats.liked}，看Story${stats.storiesWatched}，浏览${stats.feedViewed + stats.exploreScrolled}，健康度${newHealth}`, 'ok');

    if (stats.warnings.length > 0) {
      addLog(account.username, `注意：${stats.warnings.length}条异常警告`, 'warn');
    }
  } catch (e) {
    addLog(account.username, `养号异常: ${e.message}`, 'error');
    schedulerState.accountStats[accountId].status = 'error';
    db.updateAccount(accountId, { warmup_status: 'idle', status: 'error' });
  }

  // 关闭浏览器
  try { await igDriver.close(accountId); } catch (e) {}
}

/**
 * 批量启动所有账号养号
 * @param {Object} options
 * @param {string} options.mode - 'auto'（按养号计划自动）/ 'conservative' / 'standard' / 'custom'
 * @param {Array} options.accountIds - 指定账号ID（空=全部启用账号）
 * @param {Object} options.customParams - 自定义模式参数
 * @param {Function} options.onStatusUpdate - 状态推送回调
 */
async function startBatchWarmup(options = {}) {
  if (schedulerState.running) {
    return { success: false, error: '已有养号任务正在运行' };
  }

  schedulerState.running = true;
  schedulerState.paused = false;
  schedulerState.stopped = false;
  schedulerState.accountStats = {};
  schedulerState.logs = [];
  schedulerState.onStatusUpdate = options.onStatusUpdate || null;

  addLog('系统', '========== 批量养号启动 ==========', 'info');

  // 获取账号列表
  let accounts = db.getAccounts().filter(a => a.enabled !== false && a.status !== 'banned');
  if (options.accountIds && options.accountIds.length > 0) {
    accounts = accounts.filter(a => options.accountIds.includes(a.id));
  }

  if (accounts.length === 0) {
    schedulerState.running = false;
    return { success: false, error: '没有可用的账号' };
  }

  addLog('系统', `共 ${accounts.length} 个账号，模式: ${options.mode || 'auto'}`);

  // 后台执行（不阻塞）
  (async () => {
    for (const account of accounts) {
      if (schedulerState.stopped) break;
      while (schedulerState.paused && !schedulerState.stopped) {
        await new Promise(r => setTimeout(r, 1000));
      }

      schedulerState.currentAccount = account.username;

      // 选择策略
      let strategy;
      if (options.mode === 'auto' || !options.mode) {
        strategy = db.getWarmupPlan(account);
      } else {
        strategy = db.getManualStrategy(options.mode, options.customParams);
      }

      await runAccountWarmup(account, strategy);

      // 账号间间隔
      if (accounts.indexOf(account) < accounts.length - 1 && !schedulerState.stopped) {
        const delay = 20000 + Math.random() * 20000;
        addLog('系统', `等待 ${Math.round(delay/1000)} 秒后处理下一个账号`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    schedulerState.running = false;
    schedulerState.currentAccount = null;
    addLog('系统', '========== 批量养号完成 ==========', 'ok');
    if (schedulerState.onStatusUpdate) schedulerState.onStatusUpdate(getStatus());
  })();

  return { success: true, accountCount: accounts.length };
}

/**
 * 单个账号手动养号
 */
async function startSingleWarmup(accountId, mode = 'auto', customParams = {}) {
  const account = db.getAccount(accountId);
  if (!account) return { success: false, error: '账号不存在' };

  const strategy = mode === 'auto' ? db.getWarmupPlan(account) : db.getManualStrategy(mode, customParams);

  schedulerState.running = true;
  schedulerState.currentAccount = account.username;
  schedulerState.accountStats = {};

  await runAccountWarmup(account, strategy);

  schedulerState.running = false;
  schedulerState.currentAccount = null;
  return { success: true };
}

/**
 * 暂停排程
 */
function pauseWarmup() {
  if (!schedulerState.running) return { success: false, error: '没有运行中的任务' };
  schedulerState.paused = true;
  addLog('系统', '养号已暂停', 'warn');
  return { success: true };
}

/**
 * 恢复排程
 */
function resumeWarmup() {
  if (!schedulerState.running) return { success: false, error: '没有运行中的任务' };
  schedulerState.paused = false;
  addLog('系统', '养号已恢复', 'info');
  return { success: true };
}

/**
 * 停止排程
 */
function stopWarmup() {
  if (!schedulerState.running) return { success: false, error: '没有运行中的任务' };
  schedulerState.stopped = true;
  schedulerState.paused = false;
  addLog('系统', '正在停止养号...', 'warn');
  return { success: true };
}

/**
 * 设置每日定时养号
 * @param {string} time - HH:MM 格式
 * @param {number} durationMin - 时长分钟
 */
function setDailySchedule(time, durationMin) {
  schedulerState.scheduledTime = time;
  schedulerState.scheduledDuration = durationMin;

  if (schedulerState.dailyTimer) clearInterval(schedulerState.dailyTimer);

  // 每分钟检查一次是否到点
  schedulerState.dailyTimer = setInterval(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (currentTime === time && !schedulerState.running) {
      addLog('系统', `定时养号触发（${time}）`, 'info');
      startBatchWarmup({ mode: 'auto' });
    }
  }, 60000);

  addLog('系统', `定时养号已设置：每天 ${time}，时长 ${durationMin} 分钟`, 'info');
  return { success: true, time, durationMin };
}

/**
 * 取消定时养号
 */
function clearDailySchedule() {
  if (schedulerState.dailyTimer) {
    clearInterval(schedulerState.dailyTimer);
    schedulerState.dailyTimer = null;
    addLog('系统', '定时养号已取消', 'warn');
  }
  return { success: true };
}

module.exports = {
  startBatchWarmup,
  startSingleWarmup,
  pauseWarmup,
  resumeWarmup,
  stopWarmup,
  setDailySchedule,
  clearDailySchedule,
  getStatus,
};
