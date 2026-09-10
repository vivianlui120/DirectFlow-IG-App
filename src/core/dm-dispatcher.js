/**
 * Core 多账号智能分发群发引擎
 * 主业务逻辑层，不包含任何 Puppeteer 操作
 * 通过 ig-driver 驱动层执行实际发送
 *
 * 核心能力：
 * 1. 名单提取与去重（永久/7天/10天防重规则）
 * 2. 账号平均平分算法
 * 3. Spin-Text 话术随机轮换
 * 4. 每账号每日20条上限
 * 5. 暂停/停止控制
 * 6. 实时进度回调
 */
const igDriver = require('../ig-driver');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 话术模板图片存储目录（用户数据目录，打包后可写）
const TEMPLATE_IMAGE_DIR = path.join(os.tmpdir(), 'igdm-pro-db', 'template-images');

// 群发任务状态
const dmState = {
  running: false,
  paused: false,
  stopped: false,
  config: null,
  // 各账号统计
  accountStats: {},  // { accountId: { success, failed, skipped, current, total } }
  // 全局统计
  total: { success: 0, failed: 0, skipped: 0, total: 0 },
  logs: [],
  onProgress: null,  // 进度回调函数
  imageRotateIndex: 0, // 图片轮换计数器（按批次轮换，避免连续发同一张）
};

const DAILY_LIMIT = 20; // 每账号每日最多发送20条

/**
 * Spin-Text 解析：{你好|嗨|哈囉} -> 随机选一个
 * 支持嵌套，支持多组
 */
function parseSpinText(text) {
  if (!text) return text;
  let result = text;
  // 循环处理所有 {a|b|c} 模式
  const pattern = /\{([^{}]+)\}/g;
  let match;
  while ((match = pattern.exec(result)) !== null) {
    const options = match[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)];
    result = result.substring(0, match.index) + chosen + result.substring(match.index + match[0].length);
    pattern.lastIndex = 0; // 重置，从头匹配
  }
  // 变量替换 {username} -> 目标用户名
  return result;
}

/**
 * 从话术模板中随机选一套，并解析 Spin-Text
 * 同时从所有模板的图片池中按批次轮换选一张图
 * @returns {Object} { message, imagePath }
 */
function pickMessage(templates, targetUser) {
  if (!templates || templates.length === 0) {
    return { message: '你好，很高兴认识你！', imagePath: null };
  }
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  let msg = parseSpinText(tpl.content);
  // 变量替换
  msg = msg.replace(/\{username\}/g, targetUser);
  msg = msg.replace(/\{name\}/g, targetUser);

  // 收集所有选中模板的图片，按批次轮换
  const allImages = [];
  templates.forEach(t => {
    if (t.images && t.images.length > 0) {
      t.images.forEach(img => allImages.push(img));
    }
  });

  let imagePath = null;
  if (allImages.length > 0) {
    // 按批次轮换：用全局计数器取模，确保不会连续发同一张
    const imgName = allImages[dmState.imageRotateIndex % allImages.length];
    dmState.imageRotateIndex++;
    const fullPath = path.join(TEMPLATE_IMAGE_DIR, imgName);
    if (fs.existsSync(fullPath)) {
      imagePath = fullPath;
    }
  }

  return { message: msg, imagePath };
}

/**
 * 名单提取与去重
 * @param {string} dedupRule - 'never' | '7d' | '10d' | 'off'
 * @returns {Array} 过滤后的待发送名单
 */
function extractAndDedupLeads(dedupRule) {
  const pending = db.getLeads('pending');
  const filtered = [];
  let skippedByDedup = 0;

  for (const lead of pending) {
    // 检查防重规则
    if (db.shouldSkipByDedupRule(lead.username, dedupRule)) {
      skippedByDedup++;
      db.updateLead(lead.id, { status: 'skipped', failReason: '防重规则跳过' });
      continue;
    }
    filtered.push(lead);
  }

  return { leads: filtered, skippedByDedup, totalPending: pending.length };
}

/**
 * 账号平均平分算法
 * 将名单平均分配给各账号
 * @param {Array} leads - 待发送名单
 * @param {Array} accountIds - 账号ID列表
 * @returns {Object} { accountId: [leads] }
 */
function distributeLeads(leads, accountIds) {
  const distribution = {};
  accountIds.forEach(id => { distribution[id] = []; });

  // 轮询分配，确保平均
  leads.forEach((lead, idx) => {
    const accountIdx = idx % accountIds.length;
    distribution[accountIds[accountIdx]].push(lead);
  });

  return distribution;
}

/**
 * 添加日志
 */
function addLog(account, msg, type = 'info') {
  const log = { time: new Date().toISOString(), account, msg, type };
  dmState.logs.unshift(log);
  if (dmState.logs.length > 300) dmState.logs.pop();
  db.addTaskLog({ accountId: account, targetUser: '', status: type, message: msg });
  // 触发进度回调
  if (dmState.onProgress) {
    dmState.onProgress(getProgress());
  }
}

/**
 * 获取当前进度
 */
function getProgress() {
  return {
    running: dmState.running,
    paused: dmState.paused,
    total: dmState.total,
    accountStats: { ...dmState.accountStats },
    logs: dmState.logs.slice(0, 50),
  };
}

/**
 * 单账号发送循环
 */
async function runAccount(accountId, account, leads, templates, dedupRule) {
  const stats = dmState.accountStats[accountId];
  const todaySent = db.getTodaySentCount(accountId);
  let sentToday = todaySent;

  addLog(account.username, `开始执行，分配${leads.length}个名单，今日已发${todaySent}/${DAILY_LIMIT}`);

  for (let i = 0; i < leads.length; i++) {
    // 检查停止
    if (dmState.stopped) {
      addLog(account.username, '任务已停止', 'warn');
      return;
    }
    // 检查暂停
    while (dmState.paused && !dmState.stopped) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const lead = leads[i];
    stats.current = lead.username;
    stats.index = i + 1;

    // 每日上限检查
    if (sentToday >= DAILY_LIMIT) {
      addLog(account.username, `已达每日上限${DAILY_LIMIT}条，暂停该账号`, 'warn');
      db.updateAccount(accountId, { status: 'daily_limit' });
      break;
    }

    // 二次防重检查
    if (db.shouldSkipByDedupRule(lead.username, dedupRule)) {
      stats.skipped++;
      dmState.total.skipped++;
      db.updateLead(lead.id, { status: 'skipped', failReason: '防重规则跳过' });
      addLog(account.username, `跳过 ${lead.username}（防重规则）`, 'warn');
      continue;
    }

    // 生成话术（Spin-Text + 图片轮换）
    const { message, imagePath } = pickMessage(templates, lead.username);

    addLog(account.username, `→ 发送给 ${lead.username}: "${message.substring(0, 30)}..."${imagePath ? ' [带图]' : ''}`);

    try {
      // 调用驱动层发送（支持图文一起发）
      const result = await igDriver.sendDM(accountId, lead.username, message, imagePath);

      if (result.success) {
        stats.success++;
        dmState.total.success++;
        sentToday++;
        db.updateLead(lead.id, { status: 'sent', sentAt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() });
        db.addTaskLog({ accountId, targetUser: lead.username, status: 'success', message });
        addLog(account.username, `✓ 发送成功: ${lead.username}`, 'ok');
      } else {
        stats.failed++;
        dmState.total.failed++;
        db.updateLead(lead.id, { status: 'failed', lastAttemptAt: new Date().toISOString(), failReason: result.reason });
        db.addTaskLog({ accountId, targetUser: lead.username, status: 'failed', message: result.reason });
        addLog(account.username, `✗ 发送失败: ${lead.username} (${result.reason})`, 'error');

        // 账号被限制 -> 暂停该账号
        if (result.reason === 'account_restricted') {
          addLog(account.username, `⚠️ 账号被限制私信，暂停该账号任务`, 'error');
          db.updateAccount(accountId, { status: 'restricted' });
          break;
        }
        // 触发验证码 -> 暂停该账号
        if (result.reason === 'challenge' || result.reason === 'verify') {
          addLog(account.username, `⚠️ 触发验证码，暂停该账号任务`, 'error');
          db.updateAccount(accountId, { status: 'need_verify' });
          break;
        }
      }
    } catch (e) {
      stats.failed++;
      dmState.total.failed++;
      db.updateLead(lead.id, { status: 'failed', lastAttemptAt: new Date().toISOString(), failReason: e.message });
      addLog(account.username, `✗ 异常: ${lead.username} - ${e.message}`, 'error');
    }

    // 发送后随机冷却（38-90秒），最后一条不用等
    if (i < leads.length - 1 && !dmState.stopped) {
      const waitSec = await igDriver.cooldownAfterSend();
      addLog(account.username, `冷却 ${waitSec} 秒...`);
    }
  }

  stats.current = null;
  addLog(account.username, `任务完成：成功${stats.success}，失败${stats.failed}，跳过${stats.skipped}`, 'ok');
}

/**
 * 启动群发任务
 * @param {Object} config
 * @param {Array} config.accountIds - 选中的账号ID列表
 * @param {Array} config.templateIds - 选中的话术模板ID（空=全部）
 * @param {string} config.dedupRule - 防重规则 'never'|'7d'|'10d'|'off'
 * @param {Function} config.onProgress - 进度回调
 */
async function startMassDM(config) {
  if (dmState.running) {
    return { success: false, error: '已有任务正在运行' };
  }

  dmState.running = true;
  dmState.paused = false;
  dmState.stopped = false;
  dmState.config = config;
  dmState.onProgress = config.onProgress || null;
  dmState.logs = [];
  dmState.total = { success: 0, failed: 0, skipped: 0, total: 0 };
  dmState.accountStats = {};

  addLog('系统', '========== 群发任务启动 ==========', 'info');

  // 1. 获取账号
  const allAccounts = db.getAccounts();
  const selectedAccounts = allAccounts.filter(a => config.accountIds.includes(a.id) && a.status !== 'banned');
  if (selectedAccounts.length === 0) {
    dmState.running = false;
    return { success: false, error: '没有可用的账号' };
  }
  addLog('系统', `选中 ${selectedAccounts.length} 个账号`, 'info');

  // 2. 提取并去重名单
  addLog('系统', `防重规则: ${config.dedupRule}`, 'info');
  const { leads, skippedByDedup, totalPending } = extractAndDedupLeads(config.dedupRule);
  addLog('系统', `待发送名单: ${leads.length} 个（原pending ${totalPending}，防重跳过 ${skippedByDedup}）`, 'info');

  if (leads.length === 0) {
    dmState.running = false;
    return { success: false, error: '没有可发送的名单' };
  }

  dmState.total.total = leads.length;

  // 3. 账号平均平分
  const accountIds = selectedAccounts.map(a => a.id);
  const distribution = distributeLeads(leads, accountIds);
  for (const acc of selectedAccounts) {
    dmState.accountStats[acc.id] = {
      username: acc.username,
      success: 0, failed: 0, skipped: 0,
      current: null,
      total: distribution[acc.id].length,
      index: 0,
    };
    addLog('系统', `${acc.username} 分配 ${distribution[acc.id].length} 个名单`);
  }

  // 4. 获取话术模板
  let templates = db.getTemplates();
  if (config.templateIds && config.templateIds.length > 0) {
    templates = templates.filter(t => config.templateIds.includes(t.id));
  }
  addLog('系统', `话术模板: ${templates.length} 套（支持Spin-Text随机轮换）`, 'info');

  // 5. 启动所有账号的浏览器实例（headless静默）
  addLog('系统', '启动浏览器实例（headless静默模式）...', 'info');
  const launchedAccounts = [];
  for (const acc of selectedAccounts) {
    try {
      await igDriver.launch({
        accountId: acc.id,
        proxyHost: acc.proxyHost,
        proxyPort: acc.proxyPort,
        proxyUser: acc.proxyUser,
        proxyPass: acc.proxyPass,
        fingerprint: acc.fingerprint,
        headless: true, // 强制静默运行
      });
      launchedAccounts.push(acc);
      addLog(acc.username, '浏览器实例已启动', 'ok');
    } catch (e) {
      addLog(acc.username, `浏览器启动失败: ${e.message}`, 'error');
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (launchedAccounts.length === 0) {
    dmState.running = false;
    return { success: false, error: '所有账号浏览器启动失败' };
  }

  // 6. 并发执行各账号发送（每个账号独立循环，互不影响）
  const runPromises = launchedAccounts.map(acc =>
    runAccount(acc.id, acc, distribution[acc.id], templates, config.dedupRule)
  );

  // 后台执行，不阻塞
  Promise.all(runPromises).then(() => {
    dmState.running = false;
    addLog('系统', '========== 群发任务全部完成 ==========', 'ok');
    addLog('系统', `总计：成功${dmState.total.success}，失败${dmState.total.failed}，跳过${dmState.total.skipped}`, 'ok');
    // 关闭所有浏览器
    for (const acc of launchedAccounts) {
      try { igDriver.close(acc.id); } catch (e) {}
    }
    if (dmState.onProgress) dmState.onProgress(getProgress());
  });

  return { success: true, totalLeads: leads.length, accounts: launchedAccounts.length };
}

/**
 * 暂停群发
 */
function pauseMassDM() {
  if (!dmState.running) return { success: false, error: '没有运行中的任务' };
  dmState.paused = true;
  addLog('系统', '任务已暂停', 'warn');
  return { success: true };
}

/**
 * 恢复群发
 */
function resumeMassDM() {
  if (!dmState.running) return { success: false, error: '没有运行中的任务' };
  dmState.paused = false;
  addLog('系统', '任务已恢复', 'info');
  return { success: true };
}

/**
 * 停止群发
 */
function stopMassDM() {
  if (!dmState.running) return { success: false, error: '没有运行中的任务' };
  dmState.stopped = true;
  dmState.paused = false;
  addLog('系统', '正在停止任务...', 'warn');
  return { success: true };
}

/**
 * 获取群发状态
 */
function getMassDMStatus() {
  return getProgress();
}

module.exports = {
  startMassDM,
  pauseMassDM,
  resumeMassDM,
  stopMassDM,
  getMassDMStatus,
  parseSpinText,
  extractAndDedupLeads,
  distributeLeads,
  DAILY_LIMIT,
};
