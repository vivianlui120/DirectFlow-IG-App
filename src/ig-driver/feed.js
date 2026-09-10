/**
 * IG-Driver Feed 模块
 * 负责：刷Feed流、随机滚动、随机点赞、模拟真人浏览行为
 */
const browser = require('./browser');
const SELECTORS = browser.SELECTORS;

/**
 * 打开首页Feed
 */
async function openFeed(accountId) {
  return await browser.safeGoto(accountId, SELECTORS.feed.url);
}

/**
 * 获取当前页面帖子数量
 */
async function getPostCount(accountId) {
  const { page } = browser.getInstance(accountId);
  return await page.evaluate((sel) => {
    return document.querySelectorAll(sel).length;
  }, SELECTORS.feed.postContainer);
}

/**
 * 检查帖子是否已点赞
 */
async function isPostLiked(accountId, postIndex = 0) {
  const { page } = browser.getInstance(accountId);
  return await page.evaluate((sel, idx) => {
    const posts = document.querySelectorAll(sel.postContainer);
    if (!posts[idx]) return false;
    const likeBtn = posts[idx].querySelector(sel.likeButton);
    const unlikeBtn = posts[idx].querySelector(sel.unlikeButton);
    // 如果存在 unlikeButton 说明已经点赞了
    return !!unlikeBtn || (likeBtn && likeBtn.getAttribute('aria-label')?.includes('取消'));
  }, SELECTORS.feed, postIndex);
}

/**
 * 给指定帖子点赞（真实鼠标点击）
 */
async function likePost(accountId, postIndex = 0) {
  const { page } = browser.getInstance(accountId);
  const liked = await isPostLiked(accountId, postIndex);
  if (liked) return { alreadyLiked: true };

  // 先滚动到帖子可见
  await page.evaluate((sel, idx) => {
    const posts = document.querySelectorAll(sel.postContainer);
    if (posts[idx]) posts[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, SELECTORS.feed, postIndex);
  await browser.randomDelay(800, 1500);

  // 给目标点赞按钮打临时标记
  const marked = await page.evaluate((sel, idx) => {
    const posts = document.querySelectorAll(sel.postContainer);
    if (!posts[idx]) return false;
    const likeBtn = posts[idx].querySelector('svg[aria-label="赞"], svg[aria-label="Like"], svg[aria-label="喜欢"]');
    if (likeBtn) {
      const target = likeBtn.closest('div[role="button"], button') || likeBtn;
      target.setAttribute('data-like-target', '1');
      return true;
    }
    return false;
  }, SELECTORS.feed, postIndex);

  if (marked) {
    // 真实鼠标点击
    await browser.humanClick(accountId, '[data-like-target="1"]');
    // 清理标记
    await page.evaluate(() => {
      document.querySelectorAll('[data-like-target="1"]').forEach(el => el.removeAttribute('data-like-target'));
    });
  } else {
    // 降级：JS 点击
    await page.evaluate((sel, idx) => {
      const posts = document.querySelectorAll(sel.postContainer);
      if (!posts[idx]) return false;
      const likeBtn = posts[idx].querySelector('svg[aria-label="赞"], svg[aria-label="Like"]');
      if (likeBtn) {
        likeBtn.closest('div[role="button"], button')?.click();
        return true;
      }
      return false;
    }, SELECTORS.feed, postIndex);
  }

  await browser.randomDelay(800, 1500);
  return { liked: true };
}

/**
 * 模拟真人刷Feed（滚动 + 随机停留 + 随机点赞）
 * @param {Object} options
 * @param {number} options.scrollCount - 滚动次数
 * @param {number} options.likeProbability - 点赞概率 (0-1)
 * @param {number} options.minStay - 每帖最少停留ms
 * @param {number} options.maxStay - 每帖最多停留ms
 */
async function browseFeed(accountId, options = {}) {
  const config = {
    scrollCount: options.scrollCount || 10,
    likeProbability: options.likeProbability || 0.3,
    minStay: options.minStay || 2000,
    maxStay: options.maxStay || 5000,
  };

  const stats = { scrolled: 0, liked: 0, skipped: 0, errors: 0 };

  await openFeed(accountId);
  await browser.randomDelay(2000, 4000);

  for (let i = 0; i < config.scrollCount; i++) {
    try {
      // 模拟阅读停留
      const stay = Math.floor(Math.random() * (config.maxStay - config.minStay)) + config.minStay;
      await browser.randomDelay(stay * 0.3, stay);

      // 随机点赞
      if (Math.random() < config.likeProbability) {
        const postIdx = Math.floor(Math.random() * 3);
        const result = await likePost(accountId, postIdx);
        if (result.liked) {
          stats.liked++;
        } else {
          stats.skipped++;
        }
        await browser.randomDelay(1000, 2500);
      }

      // 滚动到下一个帖子
      await browser.humanScroll(accountId, 'down', 400 + Math.random() * 300);
      stats.scrolled++;
    } catch (e) {
      stats.errors++;
    }
  }

  return stats;
}

/**
 * 浏览单个帖子（模拟认真看内容）
 */
async function viewPost(accountId, postIndex = 0) {
  const { page } = browser.getInstance(accountId);

  // 滚动到帖子可见
  await page.evaluate((sel, idx) => {
    const posts = document.querySelectorAll(sel.postContainer);
    if (posts[idx]) posts[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, SELECTORS.feed, postIndex);

  await browser.randomDelay(1500, 3500);

  // 模拟看图片（如果有图片多图，模拟切换）
  const hasMultipleImages = await page.evaluate((sel, idx) => {
    const posts = document.querySelectorAll(sel.postContainer);
    if (!posts[idx]) return false;
    return posts[idx].querySelectorAll('img').length > 1;
  }, SELECTORS.feed, postIndex);

  if (hasMultipleImages && Math.random() > 0.5) {
    // 模拟点击下一张图
    try {
      await page.evaluate((sel, idx) => {
        const posts = document.querySelectorAll(sel.postContainer);
        if (!posts[idx]) return;
        const nextBtn = posts[idx].querySelector(sel.nextPostBtn);
        if (nextBtn) nextBtn.click();
      }, SELECTORS.feed, postIndex);
      await browser.randomDelay(1000, 2000);
    } catch (e) {}
  }

  return true;
}

module.exports = {
  openFeed,
  getPostCount,
  isPostLiked,
  likePost,
  browseFeed,
  viewPost,
};
