/**
 * IG-Driver 私信(DM)发送模块
 * 所有 Puppeteer DOM 操作集中在此文件
 * headless 无头背景模式下静默执行
 *
 * 核心能力：
 * - 模拟真人逐字输入（50-150ms/字）
 * - 随机冷却间隔（38-90秒/条）
 * - 异常捕获与分类（限制私信/关闭DM/验证码）
 */
const browser = require('./browser');
const SELECTORS = require('./selectors');

// 风控关键词（检测到说明账号被限制或触发验证）
const RISK_KEYWORDS = [
  '限制私信', '暂时无法', '操作频繁', '请求过多', 'try again later',
  '稍后再试', 'temporarily blocked', 'action blocked', '无法发送',
  '验证码', 'challenge', 'checkpoint', 'verify', '可疑活动',
  'confirm', '验证', 'security', '限制', 'rate limit',
];

/**
 * 发送单条私信
 * @param {string} accountId - 浏览器实例ID
 * @param {string} targetUser - 目标用户名
 * @param {string} message - 消息内容
 * @param {string} [imagePath] - 图片文件绝对路径（可选，有则图文一起发）
 * @returns {Object} { success, reason, error }
 */
async function sendDM(accountId, targetUser, message, imagePath = null) {
  const result = { success: false, reason: null, error: null };
  const { page } = browser.getInstance(accountId);

  try {
    // 1. 进入私信收件箱
    await browser.safeGoto(accountId, SELECTORS.dm.url, 'domcontentloaded', 20000);
    await browser.randomDelay(1500, 3000);

    // 2. 处理通知弹窗
    try {
      await page.waitForSelector(SELECTORS.dm.notifDenyBtn, { timeout: 3000 });
      await browser.humanClick(accountId, SELECTORS.dm.notifDenyBtn);
      await browser.randomDelay(800, 1500);
    } catch (e) { /* 无弹窗跳过 */ }

    // 3. 点击新消息按钮
    await page.waitForSelector(SELECTORS.dm.newMessageBtn, { timeout: 10000 });
    await browser.humanClick(accountId, SELECTORS.dm.newMessageBtn);
    await browser.randomDelay(1000, 2000);

    // 4. 搜索目标用户
    await page.waitForSelector(SELECTORS.dm.searchInput, { timeout: 10000 });
    await page.type(SELECTORS.dm.searchInput, targetUser, { delay: 80 + Math.random() * 60 });
    await browser.randomDelay(1500, 2500);

    // 5. 选择第一个搜索结果（真实鼠标点击）
    const userSelected = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;
      const items = dialog.querySelectorAll('div[role="button"]');
      if (items.length > 0) {
        items[0].setAttribute('data-dm-user', '1');
        return true;
      }
      return false;
    });

    if (!userSelected) {
      result.reason = 'user_not_found';
      result.error = '未找到目标用户';
      return result;
    }
    await browser.humanClick(accountId, '[data-dm-user="1"]');
    await page.evaluate(() => {
      document.querySelectorAll('[data-dm-user="1"]').forEach(el => el.removeAttribute('data-dm-user'));
    });
    await browser.randomDelay(1000, 2000);

    // 6. 点击聊天按钮（进入对话，真实鼠标）
    const chatBtnFound = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.includes('聊天') || btn.textContent.includes('Chat')) {
          btn.setAttribute('data-dm-chat', '1');
          return true;
        }
      }
      return false;
    });
    if (chatBtnFound) {
      await browser.humanClick(accountId, '[data-dm-chat="1"]');
      await page.evaluate(() => {
        document.querySelectorAll('[data-dm-chat="1"]').forEach(el => el.removeAttribute('data-dm-chat'));
      });
    }
    await browser.randomDelay(1500, 3000);

    // 7. 检测是否被限制私信
    const pageText = await page.evaluate(() => document.body.innerText);
    for (const kw of RISK_KEYWORDS) {
      if (pageText.toLowerCase().includes(kw.toLowerCase())) {
        result.reason = 'account_restricted';
        result.error = '检测到风控关键词: ' + kw;
        return result;
      }
    }

    // 8. 检测对方是否关闭DM
    if (pageText.includes('无法发送消息') || pageText.includes('不接收消息') || pageText.includes('消息权限')) {
      result.reason = 'dm_closed';
      result.error = '对方关闭了私信';
      return result;
    }

    // 9. 输入消息（模拟真人逐字打字，50-150ms/字）
    await page.waitForSelector(SELECTORS.dm.chatInput, { timeout: 10000 });
    await browser.humanClick(accountId, SELECTORS.dm.chatInput);
    await browser.randomDelay(500, 1000);

    // 逐字输入，模拟真人
    for (let i = 0; i < message.length; i++) {
      await page.type(SELECTORS.dm.chatInput, message[i], { delay: 0 });
      await browser.randomDelay(50, 150); // 每字 50-150ms
      // 每输入10个字随机停顿一下
      if (i > 0 && i % 10 === 0 && Math.random() > 0.5) {
        await browser.randomDelay(200, 600);
      }
    }
    await browser.randomDelay(800, 1500);

    // 9.5. 如果有图片，上传附件（图文一起发）
    if (imagePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(imagePath)) {
          // 点击附件按钮，同时等待文件选择器
          const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 8000 }),
            browser.humanClick(accountId, SELECTORS.dm.attachBtn).catch(() => {
              // 备用：直接找 input[type=file] 并触发
              return page.evaluate(() => {
                const input = document.querySelector('input[type="file"]');
                if (input) input.click();
              });
            }),
          ]);
          await fileChooser.accept([imagePath]);
          // 等待上传完成（图片预览出现）
          await browser.randomDelay(2000, 4000);
        }
      } catch (e) {
        // 图片上传失败不阻断文字发送，记录日志
        console.warn('图片上传失败，仅发送文字:', e.message);
      }
    }

    // 10. 按回车发送（或点击发送按钮）
    await page.keyboard.press('Enter');
    await browser.randomDelay(2000, 4000);

    // 11. 验证发送成功（检测消息出现在对话中）
    const sent = await page.evaluate((msg) => {
      const bubbles = document.querySelectorAll('div[role="row"]');
      for (const b of bubbles) {
        if (b.textContent.includes(msg.substring(0, 20))) return true;
      }
      // 备用：检测最后一条消息
      const allText = document.body.innerText;
      return allText.includes(msg.substring(0, 15));
    }, message);

    if (sent) {
      result.success = true;
    } else {
      result.reason = 'send_failed';
      result.error = '消息未出现在对话中';
    }

    return result;
  } catch (e) {
    result.error = e.message;
    // 分类异常
    if (e.message.includes('timeout') || e.message.includes('Timeout')) {
      result.reason = 'timeout';
    } else if (e.message.includes('Navigation')) {
      result.reason = 'navigation_error';
    } else {
      result.reason = 'unknown_error';
    }
    return result;
  }
}

/**
 * 发送后随机冷却（38-90秒）
 * 模拟真人发送间隔，防风控
 */
async function cooldownAfterSend() {
  const delay = 38000 + Math.random() * 52000; // 38-90秒
  await new Promise(r => setTimeout(r, delay));
  return Math.round(delay / 1000);
}

/**
 * 检查账号是否能正常发DM（进入DM页面检测）
 */
async function checkDMAbility(accountId) {
  try {
    const { page } = browser.getInstance(accountId);
    await browser.safeGoto(accountId, SELECTORS.dm.url, 'domcontentloaded', 15000);
    await browser.randomDelay(2000, 3000);
    const text = await page.evaluate(() => document.body.innerText);
    for (const kw of RISK_KEYWORDS) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        return { canSend: false, reason: kw };
      }
    }
    return { canSend: true };
  } catch (e) {
    return { canSend: false, reason: e.message };
  }
}

module.exports = {
  sendDM,
  cooldownAfterSend,
  checkDMAbility,
  RISK_KEYWORDS,
};
