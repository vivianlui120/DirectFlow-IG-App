/**
 * IG-Driver Story 模块
 * 负责：打开Story、自动观看、模拟点击下一个、随机停留
 */
const browser = require('./browser');
const SELECTORS = browser.SELECTORS;

/**
 * 打开第一个 Story
 */
async function openFirstStory(accountId) {
  const { page } = browser.getInstance(accountId);

  // 先确保在首页
  await browser.safeGoto(accountId, SELECTORS.feed.url, 'domcontentloaded');
  await browser.randomDelay(2000, 3500);

  // 点击第一个 Story（真实鼠标）
  await page.evaluate((sel) => {
    const story = document.querySelector(sel.story.firstStory);
    if (story) story.setAttribute('data-story-target', '1');
  }, SELECTORS.story);

  const clicked = await browser.humanClick(accountId, '[data-story-target="1"]');
  await page.evaluate(() => {
    document.querySelectorAll('[data-story-target="1"]').forEach(el => el.removeAttribute('data-story-target'));
  });

  if (clicked) {
    await browser.randomDelay(2000, 4000);
  }
  return clicked;
}

/**
 * 检查是否正在观看 Story
 */
async function isWatchingStory(accountId) {
  const { page } = browser.getInstance(accountId);
  return await page.evaluate((sel) => {
    return document.querySelector(sel.story.storyContainer) !== null;
  }, SELECTORS.story);
}

/**
 * 点击下一个 Story（真实鼠标）
 */
async function nextStory(accountId) {
  const { page } = browser.getInstance(accountId);
  await page.evaluate((sel) => {
    const next = document.querySelector(sel.story.storyNext);
    if (next) next.setAttribute('data-story-next', '1');
  }, SELECTORS.story);
  await browser.humanClick(accountId, '[data-story-next="1"]');
  await page.evaluate(() => {
    document.querySelectorAll('[data-story-next="1"]').forEach(el => el.removeAttribute('data-story-next'));
  });
  await browser.randomDelay(300, 800);
  return true;
}

/**
 * 关闭 Story（真实鼠标）
 */
async function closeStory(accountId) {
  const { page } = browser.getInstance(accountId);
  await page.evaluate((sel) => {
    const close = document.querySelector(sel.story.storyClose);
    if (close) {
      const target = close.closest('button, div[role="button"]') || close;
      target.setAttribute('data-story-close', '1');
    }
  }, SELECTORS.story);
  await browser.humanClick(accountId, '[data-story-close="1"]');
  await page.evaluate(() => {
    document.querySelectorAll('[data-story-close="1"]').forEach(el => el.removeAttribute('data-story-close'));
  });
  await browser.randomDelay(800, 1500);
  return true;
}

/**
 * 自动观看多个 Story（模拟真人）
 * @param {Object} options
 * @param {number} options.count - 观看数量
 * @param {number} options.minStay - 每个最少停留ms
 * @param {number} options.maxStay - 每个最多停留ms
 * @param {number} options.skipProbability - 跳过概率（模拟没兴趣直接点下一个）
 */
async function watchStories(accountId, options = {}) {
  const config = {
    count: options.count || 10,
    minStay: options.minStay || 1500,
    maxStay: options.maxStay || 4000,
    skipProbability: options.skipProbability || 0.2,
  };

  const stats = { watched: 0, skipped: 0, errors: 0 };

  const opened = await openFirstStory(accountId);
  if (!opened) {
    stats.errors++;
    return stats;
  }

  for (let i = 0; i < config.count; i++) {
    try {
      const watching = await isWatchingStory(accountId);
      if (!watching) break;

      // 模拟观看停留
      if (Math.random() < config.skipProbability) {
        // 快速跳过
        await browser.randomDelay(300, 800);
        stats.skipped++;
      } else {
        // 正常观看
        const stay = Math.floor(Math.random() * (config.maxStay - config.minStay)) + config.minStay;
        await browser.randomDelay(stay);
        stats.watched++;
      }

      // 下一个
      await nextStory(accountId);
    } catch (e) {
      stats.errors++;
    }
  }

  // 关闭 Story
  try { await closeStory(accountId); } catch (e) {}

  return stats;
}

/**
 * 获取当前可用 Story 数量
 */
async function getAvailableStoryCount(accountId) {
  const { page } = browser.getInstance(accountId);
  await browser.safeGoto(accountId, SELECTORS.feed.url, 'domcontentloaded');
  await browser.randomDelay(1500, 2500);
  return await page.evaluate((sel) => {
    return document.querySelectorAll(sel.story.firstStory).length;
  }, SELECTORS.story);
}

module.exports = {
  openFirstStory,
  isWatchingStory,
  nextStory,
  closeStory,
  watchStories,
  getAvailableStoryCount,
};
