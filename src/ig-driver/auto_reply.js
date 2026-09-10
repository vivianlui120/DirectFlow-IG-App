/**
 * IG-Driver 自动回复与收件匣监听模块
 * 所有 Puppeteer DOM 操作集中在此文件
 * headless 无头背景模式下静默执行
 *
 * 核心能力：
 * - 扫描收件匣未读消息
 * - 读取最新消息并匹配关键字规则
 * - 模拟真人打字发送回复
 * - 标记对话为已读
 */
const browser = require('./browser');
const SELECTORS = require('./selectors');

/**
 * 打开收件匣并获取未读对话列表
 * @param {string} accountId
 * @returns {Array} [{ index, username, preview }]
 */
async function getUnreadConversations(accountId) {
  const { page } = browser.getInstance(accountId);

  // 打开收件匣
  await browser.safeGoto(accountId, SELECTORS.dm.url, 'domcontentloaded', 20000);
  await browser.randomDelay(2000, 3500);

  // 处理通知弹窗
  try {
    await page.waitForSelector(SELECTORS.dm.notifDenyBtn, { timeout: 3000 });
    await browser.humanClick(accountId, SELECTORS.dm.notifDenyBtn);
    await browser.randomDelay(800, 1500);
  } catch (e) { /* 无弹窗跳过 */ }

  // 提取对话列表，检测未读
  const conversations = await page.evaluate(() => {
    const results = [];
    // IG 收件匣对话列表元素
    const items = document.querySelectorAll('div[role="row"]');
    items.forEach((item, index) => {
      // 检测未读：蓝色圆点 / 加粗文字 / 未读数
      const hasUnreadDot = item.querySelector('div[style*="background-color: rgb(0, 149, 246)"]') ||
                           item.querySelector('.x1fg9s2l') ||
                           item.querySelector('[data-testid="unread-indicator"]');
      const isBold = item.querySelector('span[style*="font-weight: 700"]') ||
                     item.querySelector('span[style*="font-weight: bold"]');
      // 备用：检测是否有未读数字标记
      const unreadBadge = item.querySelector('[data-testid="new-notification"]');

      if (hasUnreadDot || isBold || unreadBadge) {
        const nameEl = item.querySelector('span[dir="auto"]');
        const previewEl = item.querySelector('span[class*="message"]');
        results.push({
          index,
          username: nameEl ? nameEl.textContent.trim() : '',
          preview: previewEl ? previewEl.textContent.trim() : '',
        });
      }
    });
    return results;
  });

  return conversations;
}

/**
 * 点击指定对话并读取最新一条消息
 * @param {string} accountId
 * @param {number} convIndex - 对话在列表中的索引
 * @returns {Object} { sender, message } | null
 */
async function openConversationAndRead(accountId, convIndex) {
  const { page } = browser.getInstance(accountId);

  // 点击对话（打标记后真实鼠标点击）
  const clicked = await page.evaluate((idx) => {
    const items = document.querySelectorAll('div[role="row"]');
    if (!items[idx]) return false;
    items[idx].setAttribute('data-conv-target', '1');
    return true;
  }, convIndex);

  if (!clicked) return null;

  await browser.humanClick(accountId, '[data-conv-target="1"]');
  await page.evaluate(() => {
    document.querySelectorAll('[data-conv-target="1"]').forEach(el => el.removeAttribute('data-conv-target'));
  });
  await browser.randomDelay(1500, 3000);

  // 读取最新消息（最后一条非自己发送的消息）
  const latest = await page.evaluate(() => {
    const bubbles = document.querySelectorAll('div[role="row"]');
    if (bubbles.length === 0) return null;

    // 从后往前找，跳过自己发的消息（右侧气泡）
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bubble = bubbles[i];
      const textEl = bubble.querySelector('div[dir="auto"]');
      if (!textEl) continue;
      const text = textEl.textContent.trim();
      if (!text) continue;

      // 判断是否是对方发的（左侧气泡通常有不同的对齐方式）
      const isOwn = bubble.querySelector('[data-testid="message-out"]') ||
                    bubble.closest('div[class*="justify-end"]') ||
                    bubble.style.justifyContent === 'flex-end';
      if (!isOwn) {
        return { sender: '', message: text };
      }
    }
    return null;
  });

  return latest;
}

/**
 * 匹配关键字规则
 * @param {string} message - 收到的消息
 * @param {Array} rules - 规则列表
 * @returns {Object} { matched, rule, reply }
 */
function matchRule(message, rules) {
  if (!message || !rules || rules.length === 0) {
    return { matched: false, rule: null, reply: null };
  }

  const msg = message.toLowerCase().trim();

  // 1. 先匹配精准匹配
  for (const rule of rules) {
    if (rule.match_type === 'exact' && rule.is_active !== false) {
      if (msg === rule.keyword.toLowerCase().trim()) {
        return { matched: true, rule, reply: pickReply(rule.reply_content) };
      }
    }
  }

  // 2. 再匹配包含匹配
  for (const rule of rules) {
    if (rule.match_type === 'contains' && rule.is_active !== false) {
      if (msg.includes(rule.keyword.toLowerCase().trim())) {
        return { matched: true, rule, reply: pickReply(rule.reply_content) };
      }
    }
  }

  // 3. 兜底规则
  const fallback = rules.find(r => r.match_type === 'default_fallback' && r.is_active !== false);
  if (fallback) {
    return { matched: true, rule: fallback, reply: pickReply(fallback.reply_content) };
  }

  return { matched: false, rule: null, reply: null };
}

/**
 * 从回复内容中随机选一套（支持多套用 ||| 分隔）
 */
function pickReply(replyContent) {
  if (!replyContent) return '';
  const options = replyContent.split('|||').map(s => s.trim()).filter(Boolean);
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 发送回复（模拟真人逐字打字）
 * @param {string} accountId
 * @param {string} reply
 */
async function sendReply(accountId, reply) {
  const { page } = browser.getInstance(accountId);

  // 点击输入框
  await page.waitForSelector(SELECTORS.dm.chatInput, { timeout: 10000 });
  await browser.humanClick(accountId, SELECTORS.dm.chatInput);
  await browser.randomDelay(500, 1000);

  // 逐字输入，模拟真人（50-100ms/字）
  for (let i = 0; i < reply.length; i++) {
    await page.type(SELECTORS.dm.chatInput, reply[i], { delay: 0 });
    await browser.randomDelay(50, 100);
    // 每输入8个字随机停顿
    if (i > 0 && i % 8 === 0 && Math.random() > 0.5) {
      await browser.randomDelay(150, 400);
    }
  }
  await browser.randomDelay(600, 1200);

  // 按回车发送
  await page.keyboard.press('Enter');
  await browser.randomDelay(1500, 3000);

  return true;
}

/**
 * 标记当前对话为已读（通过点击对话区域触发已读回执）
 * IG 在打开对话后通常自动标记已读，这里做额外确认
 */
async function markAsRead(accountId) {
  const { page } = browser.getInstance(accountId);
  // 打开对话后 IG 通常自动标记已读
  // 额外点击消息区域确保已读
  try {
    await page.evaluate(() => {
      const chatArea = document.querySelector('div[role="main"]');
      if (chatArea) chatArea.click();
    });
    await browser.randomDelay(500, 1000);
  } catch (e) {}
  return true;
}

/**
 * 主流程：检查收件匣并自动回复
 * @param {Object} account - 账号对象 { id, username }
 * @param {Array} rulesList - 关键字规则列表
 * @param {Function} shouldSkip - 防重检查函数 (accountId, senderUsername) => boolean
 * @param {Function} onReply - 回复成功回调 (logData) => void
 * @returns {Object} { checked, replied, skipped, errors }
 */
async function checkInboxAndReply(account, rulesList, shouldSkip, onReply) {
  const stats = { checked: 0, replied: 0, skipped: 0, errors: 0 };

  try {
    // 1. 获取未读对话
    const unreadList = await getUnreadConversations(account.id);
    stats.checked = unreadList.length;

    if (unreadList.length === 0) {
      return stats;
    }

    // 2. 逐个处理未读对话（最多处理5个，避免长时间占用）
    const maxProcess = Math.min(unreadList.length, 5);
    for (let i = 0; i < maxProcess; i++) {
      try {
        const conv = unreadList[i];

        // 防重检查：24小时内已回复过则跳过
        if (shouldSkip && conv.username && shouldSkip(account.id, conv.username)) {
          stats.skipped++;
          continue;
        }

        // 3. 打开对话并读取最新消息
        const latest = await openConversationAndRead(account.id, conv.index);
        if (!latest || !latest.message) {
          continue;
        }

        // 4. 匹配关键字规则
        const { matched, rule, reply } = matchRule(latest.message, rulesList);
        if (!matched || !reply) {
          // 未匹配也标记已读，避免重复扫描
          await markAsRead(account.id);
          continue;
        }

        // 5. 发送回复
        await sendReply(account.id, reply);
        await markAsRead(account.id);
        stats.replied++;

        // 6. 回调记录日志
        if (onReply) {
          onReply({
            account_id: account.id,
            account_username: account.username,
            sender_username: conv.username || latest.sender || 'unknown',
            received_message: latest.message,
            matched_keyword: rule ? rule.keyword : '',
            sent_reply: reply,
          });
        }

        // 回复后间隔，避免太快
        await browser.randomDelay(3000, 6000);

      } catch (e) {
        stats.errors++;
        console.error(`自动回复错误 [${account.username}]:`, e.message);
      }
    }

  } catch (e) {
    stats.errors++;
    console.error(`收件匣扫描失败 [${account.username}]:`, e.message);
  }

  return stats;
}

module.exports = {
  checkInboxAndReply,
  getUnreadConversations,
  openConversationAndRead,
  matchRule,
  sendReply,
  markAsRead,
};
