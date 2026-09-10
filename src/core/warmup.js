/**
 * Core 智能养号引擎
 * 多账号背景静默模拟真人行为：刷Feed、看Story、随机点赞
 * 提升账号权重，降低封号风险
 */
const igDriver = require('../ig-driver');
const db = require('./db');

// 养号任务状态
const warmupState = {
  running: false,
  timer: null,
  currentAccount: null,
  logs: [],
};

/**
 * 执行单个账号的养号流程
 * @param {Object} account - 账号信息
 * @param {Object} settings - 养号设置
 */
async function warmupAccount(account, settings) {
  const log = (msg, type = 'info') => {
    warmupState.logs.unshift({ time: new Date().toISOString(), account: account.username, msg, type });
    if (warmupState.logs.length > 200) warmupState.logs.pop();
    db.addWarmupLog({ accountId: account.id, account: account.username, msg, type });
  };

  log(`开始养号: ${account.username}`);

  // 1. 启动浏览器（headless静默运行）
  log('启动浏览器实例（静默模式）...');
  const launchResult = await igDriver.launch({
    accountId: account.id,
    proxyHost: account.proxyHost || settings.proxy.defaultHost,
    proxyPort: account.proxyPort || settings.proxy.defaultPort,
    proxyUser: account.proxyUser || settings.proxy.defaultUser,
    proxyPass: account.proxyPass || settings.proxy.defaultPass,
    fingerprint: account.fingerprint,
    headless: true, // 强制静默运行
  });
  log(`浏览器已启动，代理: ${launchResult.proxy}`);

  try {
    // 2. 检测登录状态
    log('检测登录状态...');
    const loggedIn = await igDriver.isLoggedIn(account.id);
    if (!loggedIn) {
      log('未检测到登录态，尝试自动登录...', 'warn');
      if (account.username && account.password) {
        const loginResult = await igDriver.login(account.id, account.username, account.password, account.twofaSecret);
        if (loginResult.need2FA) {
          log('需要2FA验证，请手动登录后再使用养号功能', 'warn');
          await igDriver.close(account.id);
          db.updateAccount(account.id, { status: 'need_2fa' });
          return { success: false, reason: 'need_2fa' };
        }
        if (!loginResult.success) {
          log(`登录失败: ${loginResult.error || '未知错误'}`, 'error');
          await igDriver.close(account.id);
          db.updateAccount(account.id, { status: 'login_failed' });
          return { success: false, reason: 'login_failed' };
        }
        log('登录成功');
      } else {
        log('未配置账号密码，跳过', 'warn');
        await igDriver.close(account.id);
        return { success: false, reason: 'no_credentials' };
      }
    } else {
      log('已有登录态，直接开始养号');
    }

    db.updateAccount(account.id, { status: 'warming', lastActive: new Date().toISOString() });

    // 3. 刷 Feed
    log(`开始刷Feed（滚动${settings.warmup.feedScrollCount}次，点赞概率${settings.warmup.likeProbability * 100}%）...`);
    const feedStats = await igDriver.browseFeed(account.id, {
      scrollCount: settings.warmup.feedScrollCount,
      likeProbability: settings.warmup.likeProbability,
      minStay: settings.warmup.minStayMs,
      maxStay: settings.warmup.maxStayMs,
    });
    log(`Feed浏览完成: 滚动${feedStats.scrolled}次, 点赞${feedStats.liked}个, 跳过${feedStats.skipped}个`);

    // 4. 看 Story
    log(`开始观看Story（${settings.warmup.storyCount}个）...`);
    const storyStats = await igDriver.watchStories(account.id, {
      count: settings.warmup.storyCount,
      minStay: settings.warmup.minStayMs,
      maxStay: settings.warmup.maxStayMs,
    });
    log(`Story观看完成: 观看${storyStats.watched}个, 跳过${storyStats.skipped}个`);

    // 5. 更新账号数据
    const updated = db.updateAccount(account.id, {
      status: 'active',
      totalLikes: (account.totalLikes || 0) + feedStats.liked,
      totalStories: (account.totalStories || 0) + storyStats.watched,
      totalFeedViews: (account.totalFeedViews || 0) + feedStats.scrolled,
      warmupLevel: Math.min(10, (account.warmupLevel || 0) + 1),
      lastActive: new Date().toISOString(),
    });

    log(`养号完成！账号等级: ${updated.warmupLevel}/10, 累计点赞: ${updated.totalLikes}`);

    // 6. 关闭浏览器
    await igDriver.close(account.id);
    log('浏览器已关闭');

    return { success: true, feedStats, storyStats };
  } catch (e) {
    log(`养号异常: ${e.message}`, 'error');
    try { await igDriver.close(account.id); } catch (e2) {}
    db.updateAccount(account.id, { status: 'error' });
    return { success: false, error: e.message };
  }
}

/**
 * 批量养号（按顺序处理所有启用的账号）
 */
async function runWarmupCycle() {
  if (warmupState.running) return;
  warmupState.running = true;

  const settings = db.getSettings();
  const accounts = db.getAccounts().filter(a => a.enabled !== false && a.status !== 'banned');

  warmupState.logs.unshift({
    time: new Date().toISOString(),
    account: '系统',
    msg: `开始养号周期，共${accounts.length}个账号`,
    type: 'info',
  });

  for (const account of accounts) {
    if (!warmupState.running) break;
    warmupState.currentAccount = account.username;
    try {
      await warmupAccount(account, settings);
    } catch (e) {
      warmupState.logs.unshift({ time: new Date().toISOString(), account: account.username, msg: `异常: ${e.message}`, type: 'error' });
    }
    // 账号之间间隔
    if (accounts.indexOf(account) < accounts.length - 1) {
      const delay = 30000 + Math.random() * 30000; // 30-60秒
      warmupState.logs.unshift({ time: new Date().toISOString(), account: '系统', msg: `等待${Math.round(delay/1000)}秒后处理下一个账号`, type: 'info' });
      await new Promise(r => setTimeout(r, delay));
    }
  }

  warmupState.currentAccount = null;
  warmupState.running = false;
  warmupState.logs.unshift({ time: new Date().toISOString(), account: '系统', msg: '养号周期完成', type: 'info' });
}

/**
 * 启动定时养号
 */
function startAutoWarmup() {
  const settings = db.getSettings();
  if (warmupState.timer) clearInterval(warmupState.timer);
  const intervalMs = settings.warmup.intervalMinutes * 60 * 1000;
  warmupState.timer = setInterval(() => {
    if (!warmupState.running) runWarmupCycle();
  }, intervalMs);
  db.saveSettings({ ...settings, warmup: { ...settings.warmup, enabled: true } });
  return { enabled: true, intervalMinutes: settings.warmup.intervalMinutes };
}

/**
 * 停止定时养号
 */
function stopAutoWarmup() {
  if (warmupState.timer) {
    clearInterval(warmupState.timer);
    warmupState.timer = null;
  }
  warmupState.running = false;
  const settings = db.getSettings();
  db.saveSettings({ ...settings, warmup: { ...settings.warmup, enabled: false } });
  return { enabled: false };
}

/**
 * 获取养号状态
 */
function getWarmupStatus() {
  return {
    running: warmupState.running,
    currentAccount: warmupState.currentAccount,
    logs: warmupState.logs.slice(0, 50),
    autoEnabled: db.getSettings().warmup.enabled,
  };
}

/**
 * 手动触发单个账号养号
 */
async function manualWarmup(accountId) {
  const account = db.getAccount(accountId);
  if (!account) return { success: false, error: '账号不存在' };
  const settings = db.getSettings();
  return await warmupAccount(account, settings);
}

module.exports = {
  warmupAccount,
  runWarmupCycle,
  startAutoWarmup,
  stopAutoWarmup,
  getWarmupStatus,
  manualWarmup,
};
