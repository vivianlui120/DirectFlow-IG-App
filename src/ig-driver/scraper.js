/**
 * IG-Driver 名单采集驱动
 * 所有 Puppeteer DOM 操作集中在此文件
 * 严格遵守解耦规范，不离开 ig-driver 目录
 *
 * 核心能力：
 * - 采集指定账号的粉丝/关注列表
 * - 模拟真人滚动加载
 * - 过滤私密账号与异常账号
 * - 返回标准 JSON 数组
 */
const browser = require('./browser');
const SELECTORS = require('./selectors');

// 采集状态（用于停止控制）
const scrapeState = {
  shouldStop: {}, // { accountId: boolean }
};

/**
 * 请求停止采集
 */
function requestStop(accountId) {
  scrapeState.shouldStop[accountId] = true;
}

function shouldStop(accountId) {
  return scrapeState.shouldStop[accountId] === true;
}

function clearStopFlag(accountId) {
  delete scrapeState.shouldStop[accountId];
}

/**
 * 打开目标用户主页
 */
async function openProfile(accountId, targetUsername) {
  const url = SELECTORS.profile.url.replace('{username}', targetUsername);
  await browser.safeGoto(accountId, url, 'domcontentloaded', 20000);
  await browser.randomDelay(2000, 3500);
  return true;
}

/**
 * 点击粉丝/关注弹窗
 * @param {string} type - 'followers' | 'following'
 */
async function openListDialog(accountId, type) {
  const { page } = browser.getInstance(accountId);

  // 点击粉丝或关注链接
  const selector = type === 'followers' ? SELECTORS.profile.followersLink : SELECTORS.profile.followingLink;
  await page.waitForSelector(selector, { timeout: 15000 });
  await browser.randomDelay(800, 1500);
  await browser.humanClick(accountId, selector);
  await browser.randomDelay(2000, 3500);

  // 等待弹窗出现
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
  await browser.randomDelay(1000, 2000);
  return true;
}

/**
 * 从弹窗中提取当前可见的用户列表
 * @returns {Array} [{ username, fullName, isPrivate, hasAvatar }]
 */
async function extractVisibleUsers(accountId) {
  const { page } = browser.getInstance(accountId);
  return await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return [];

    // 查找用户列表项（IG 的粉丝列表结构）
    const items = dialog.querySelectorAll('div[role="button"]');
    const users = [];
    const seen = new Set();

    for (const item of items) {
      // 提取用户名（通常是链接中的文本或第一个 span）
      const links = item.querySelectorAll('a[href^="/"]');
      let username = '';
      let fullName = '';
      let hasAvatar = false;
      let isPrivate = false;

      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href !== '/' && href.length > 1) {
          const name = href.replace(/\//g, '');
          if (name && !seen.has(name) && name.length < 30) {
            username = name;
            seen.add(name);
            break;
          }
        }
      }

      if (!username) {
        // 备用：从 span 提取
        const spans = item.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent.trim();
          if (text && text.length > 2 && text.length < 30 && !text.includes(' ') && !seen.has(text)) {
            username = text;
            seen.add(text);
            break;
          }
        }
      }

      if (!username) continue;

      // 提取全名（通常在用户名下方）
      const allSpans = item.querySelectorAll('span');
      if (allSpans.length >= 2) {
        fullName = allSpans[allSpans.length - 1].textContent.trim();
        if (fullName === username) fullName = '';
      }

      // 检测头像
      hasAvatar = !!item.querySelector('img');

      // 检测私密账号（私密图标或文字）
      const itemText = item.textContent;
      isPrivate = itemText.includes('私密') || itemText.includes('Private');

      users.push({ username, fullName, isPrivate, hasAvatar });
    }

    return users;
  });
}

/**
 * 在弹窗内滚动加载更多
 */
async function scrollList(accountId) {
  const { page } = browser.getInstance(accountId);
  await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) {
      // 找到可滚动的容器
      const scrollable = dialog.querySelector('div[style*="overflow"]') || dialog;
      scrollable.scrollTop = scrollable.scrollHeight;
    }
  });
  // 随机延迟 1.5-3.5 秒，模拟真人
  await browser.randomDelay(1500, 3500);
}

/**
 * 过滤异常账号
 * - 过滤私密账号
 * - 过滤无头像账号
 * - 过滤用户名异常（纯数字、过长、特殊字符）
 */
function filterUsers(users) {
  return users.filter(u => {
    if (!u.username || u.username.length < 2) return false;
    if (u.username.length > 30) return false;
    if (u.isPrivate) return false; // 过滤私密账号
    if (!u.hasAvatar) return false; // 过滤无头像异常账号
    // 过滤纯数字用户名（大概率是异常号）
    if (/^\d+$/.test(u.username)) return false;
    // 过滤包含异常字符的
    if (/[^\w.]/.test(u.username)) return false;
    return true;
  });
}

/**
 * 采集粉丝/关注列表
 * @param {string} accountId - 浏览器实例ID
 * @param {string} targetUsername - 目标主页用户名
 * @param {number} maxCount - 最大采集数量
 * @param {string} type - 'followers' | 'following'
 * @param {Function} onProgress - 进度回调 (collected, target)
 * @returns {Array} [{ username, fullName, targetSource }]
 */
async function fetchFollowers(accountId, targetUsername, maxCount, type, onProgress) {
  clearStopFlag(accountId);
  const results = new Map(); // 用 Map 去重
  const allExtracted = [];

  try {
    // 1. 打开目标主页
    await openProfile(accountId, targetUsername);

    // 2. 打开列表弹窗
    await openListDialog(accountId, type);

    // 3. 循环滚动采集
    let noNewCount = 0;
    const maxNoNew = 5; // 连续5次没有新用户则停止

    while (results.size < maxCount && noNewCount < maxNoNew) {
      // 检查停止信号
      if (shouldStop(accountId)) break;

      // 提取当前可见用户
      const visible = await extractVisibleUsers(accountId);
      let newCount = 0;

      for (const user of visible) {
        if (!results.has(user.username)) {
          results.set(user.username, {
            username: user.username,
            fullName: user.fullName || '',
            targetSource: targetUsername,
          });
          allExtracted.push(user);
          newCount++;
        }
      }

      if (newCount === 0) {
        noNewCount++;
      } else {
        noNewCount = 0;
      }

      // 进度回调
      if (onProgress) {
        onProgress(results.size, maxCount);
      }

      // 达到目标数量
      if (results.size >= maxCount) break;

      // 滚动加载更多
      await scrollList(accountId);
    }

    // 4. 过滤异常账号
    const filtered = filterUsers(allExtracted);
    const finalResults = filtered.map(u => ({
      username: u.username,
      fullName: u.fullName || '',
      targetSource: targetUsername,
    }));

    // 去重（最终）
    const unique = [];
    const seen = new Set();
    for (const u of finalResults) {
      if (!seen.has(u.username)) {
        seen.add(u.username);
        unique.push(u);
      }
    }

    return unique.slice(0, maxCount);

  } catch (e) {
    // 返回已采集的部分
    const partial = [];
    for (const [, v] of results) partial.push(v);
    return { error: e.message, partialResults: partial };
  }
}

/**
 * 采集帖子点赞者（备用功能）
 */
async function fetchPostLikers(accountId, postUrl, maxCount, onProgress) {
  clearStopFlag(accountId);
  const results = new Map();

  try {
    await browser.safeGoto(accountId, postUrl, 'domcontentloaded', 20000);
    await browser.randomDelay(2000, 3500);

    const { page } = browser.getInstance(accountId);

    // 点击点赞数
    const likeLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const l of links) {
        if (l.textContent.includes('次赞') || l.textContent.includes('likes')) {
          l.click();
          return true;
        }
      }
      return false;
    });

    if (!likeLink) return { error: '未找到点赞列表入口', partialResults: [] };
    await browser.randomDelay(2000, 3500);

    let noNewCount = 0;
    while (results.size < maxCount && noNewCount < 5) {
      if (shouldStop(accountId)) break;

      const users = await extractVisibleUsers(accountId);
      let newCount = 0;
      for (const u of users) {
        if (!results.has(u.username)) {
          results.set(u.username, { username: u.username, fullName: u.fullName || '', targetSource: postUrl });
          newCount++;
        }
      }
      if (newCount === 0) noNewCount++;
      else noNewCount = 0;

      if (onProgress) onProgress(results.size, maxCount);
      if (results.size >= maxCount) break;
      await scrollList(accountId);
    }

    const filtered = filterUsers(Array.from(results.values()));
    return filtered.slice(0, maxCount);

  } catch (e) {
    return { error: e.message, partialResults: Array.from(results.values()) };
  }
}

module.exports = {
  fetchFollowers,
  fetchPostLikers,
  requestStop,
  shouldStop,
  openProfile,
  openListDialog,
  extractVisibleUsers,
  scrollList,
  filterUsers,
};
