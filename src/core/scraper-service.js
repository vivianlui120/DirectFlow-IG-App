/**
 * Core 名单采集服务
 * 业务逻辑层，不包含任何 Puppeteer 操作
 * 负责：任务管理、浏览器启动、调用驱动采集、写入数据库、进度推送
 */
const igDriver = require('../ig-driver');
const db = require('./db');

// 采集任务状态
const scrapeState = {
  running: false,
  stopped: false,
  currentTask: null,
  collected: [],
  onProgress: null,
};

/**
 * 启动采集任务
 * @param {Object} config
 * @param {string} config.accountId - 执行采集的账号ID
 * @param {string} config.targetUsername - 目标主页用户名
 * @param {string} config.type - 'followers' | 'following'
 * @param {number} config.maxCount - 最大采集数量
 * @param {boolean} config.autoSave - 是否自动写入数据库
 * @param {Function} config.onProgress - 进度回调
 */
async function startExtraction(config) {
  if (scrapeState.running) {
    return { success: false, error: '已有采集任务正在运行' };
  }

  scrapeState.running = true;
  scrapeState.stopped = false;
  scrapeState.collected = [];
  scrapeState.onProgress = config.onProgress || null;
  scrapeState.currentTask = {
    accountId: config.accountId,
    targetUsername: config.targetUsername,
    type: config.type,
    maxCount: config.maxCount,
    collected: 0,
    status: 'running',
    startTime: new Date().toISOString(),
  };

  // 后台执行
  (async () => {
    try {
      // 1. 获取账号信息
      const account = db.getAccount(config.accountId);
      if (!account) {
        throw new Error('账号不存在');
      }

      pushProgress(0, config.maxCount, '启动浏览器实例...');

      // 2. 启动浏览器（headless 静默）
      await igDriver.launch({
        accountId: 'scrape_' + config.accountId,
        proxyHost: account.proxyHost,
        proxyPort: account.proxyPort,
        proxyUser: account.proxyUser,
        proxyPass: account.proxyPass,
        fingerprint: account.fingerprint,
        headless: true,
      });

      pushProgress(0, config.maxCount, '检测登录状态...');

      // 3. 检测登录
      const loggedIn = await igDriver.isLoggedIn('scrape_' + config.accountId);
      if (!loggedIn) {
        if (account.username && account.password) {
          pushProgress(0, config.maxCount, '自动登录中...');
          const loginResult = await igDriver.login('scrape_' + config.accountId, account.username, account.password, account.twofaSecret);
          if (!loginResult.success) {
            throw new Error('登录失败: ' + (loginResult.error || '未知'));
          }
        } else {
          throw new Error('账号未登录且未配置密码');
        }
      }

      pushProgress(0, config.maxCount, `打开目标主页 @${config.targetUsername}...`);

      // 4. 调用驱动层采集
      const results = await igDriver.fetchFollowers(
        'scrape_' + config.accountId,
        config.targetUsername,
        config.maxCount,
        config.type,
        (collected, target) => {
          scrapeState.currentTask.collected = collected;
          pushProgress(collected, target, '采集中...');
        }
      );

      // 5. 处理结果
      let finalResults = [];
      if (results && results.error) {
        finalResults = results.partialResults || [];
        scrapeState.currentTask.error = results.error;
      } else {
        finalResults = results || [];
      }

      scrapeState.collected = finalResults;
      scrapeState.currentTask.collected = finalResults.length;

      // 6. 自动写入数据库
      if (config.autoSave !== false && finalResults.length > 0) {
        pushProgress(finalResults.length, config.maxCount, '写入数据库（去重中）...');
        const saveResult = db.saveLeads(finalResults);
        scrapeState.currentTask.saved = saveResult.added;
        scrapeState.currentTask.skipped = saveResult.skipped;
      }

      scrapeState.currentTask.status = 'completed';
      scrapeState.currentTask.endTime = new Date().toISOString();
      pushProgress(finalResults.length, config.maxCount, '采集完成');

    } catch (e) {
      scrapeState.currentTask.status = 'failed';
      scrapeState.currentTask.error = e.message;
      pushProgress(scrapeState.currentTask.collected || 0, config.maxCount, '错误: ' + e.message);
    } finally {
      // 关闭浏览器
      try { await igDriver.close('scrape_' + config.accountId); } catch (e) {}
      scrapeState.running = false;
    }
  })();

  return { success: true, task: scrapeState.currentTask };
}

/**
 * 停止采集
 */
function stopExtraction() {
  if (!scrapeState.running) {
    return { success: false, error: '没有运行中的采集任务' };
  }
  scrapeState.stopped = true;
  igDriver.stopScrape('scrape_' + scrapeState.currentTask.accountId);
  pushProgress(scrapeState.currentTask.collected || 0, scrapeState.currentTask.maxCount, '正在停止...');
  return { success: true };
}

/**
 * 获取采集状态
 */
function getStatus() {
  return {
    running: scrapeState.running,
    stopped: scrapeState.stopped,
    task: scrapeState.currentTask,
    collected: scrapeState.collected,
  };
}

/**
 * 获取已采集的名单（用于预览和导出）
 */
function getCollected() {
  return scrapeState.collected;
}

/**
 * 推送进度
 */
function pushProgress(collected, target, message) {
  if (scrapeState.onProgress) {
    scrapeState.onProgress({
      collected,
      target,
      percentage: target > 0 ? Math.round(collected / target * 100) : 0,
      message,
      task: scrapeState.currentTask,
    });
  }
}

/**
 * 导出为 CSV
 */
function exportCSV(leads) {
  const data = leads || scrapeState.collected;
  if (data.length === 0) return '';

  const headers = ['username', 'fullName', 'targetSource'];
  const rows = data.map(l => [
    `"${(l.username || '').replace(/"/g, '""')}"`,
    `"${(l.fullName || '').replace(/"/g, '""')}"`,
    `"${(l.targetSource || '').replace(/"/g, '""')}"`,
  ].join(','));

  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
}

module.exports = {
  startExtraction,
  stopExtraction,
  getStatus,
  getCollected,
  exportCSV,
};
