/**
 * IG-Driver 养号自动化驱动
 * 所有 Puppeteer DOM 操作集中在此文件
 * headless 无头背景模式下静默执行
 *
 * 核心能力：
 * - 随机刷首页/探索页（Feed/Explore），模拟真人滚动
 * - 随机点赞（可配置概率和上限）
 * - 随机观看 Story
 * - 人性化停顿（休息时间）
 */
const browser = require('./browser');
const SELECTORS = require('./selectors');
const regions = require('./regions');

const EXPLORE_URL = 'https://www.instagram.com/explore/';

/**
 * 浏览首页 Feed（滚动 + 随机停留）
 * @param {string} accountId - 实例ID
 * @param {Object} params
 * @param {number} params.scrollCount - 滚动次数
 * @param {number} params.minStay - 每帖最少停留ms
 * @param {number} params.maxStay - 每帖最多停留ms
 * @returns {Object} { scrolled, viewed }
 */
async function browseFeed(accountId, params = {}) {
  const config = {
    scrollCount: params.scrollCount || 15,
    minStay: params.minStay || 3000,
    maxStay: params.maxStay || 10000,
  };
  const stats = { scrolled: 0, viewed: 0 };

  await browser.safeGoto(accountId, SELECTORS.feed.url, 'domcontentloaded', 20000);
  await browser.randomDelay(2000, 4000);

  for (let i = 0; i < config.scrollCount; i++) {
    // 模拟阅读停留（3-10秒）
    const stay = Math.floor(Math.random() * (config.maxStay - config.minStay)) + config.minStay;
    await browser.randomDelay(Math.floor(stay * 0.3), stay);
    stats.viewed++;

    // 滚动到下一个帖子
    await browser.humanScroll(accountId, 'down', 350 + Math.random() * 250);
    stats.scrolled++;
  }

  return stats;
}

/**
 * 浏览探索页（Explore）
 */
async function browseExplore(accountId, params = {}) {
  const config = {
    scrollCount: params.scrollCount || 8,
    minStay: params.minStay || 2000,
    maxStay: params.maxStay || 6000,
  };
  const stats = { scrolled: 0, viewed: 0 };

  await browser.safeGoto(accountId, EXPLORE_URL, 'domcontentloaded', 20000);
  await browser.randomDelay(2000, 3500);

  for (let i = 0; i < config.scrollCount; i++) {
    const stay = Math.floor(Math.random() * (config.maxStay - config.minStay)) + config.minStay;
    await browser.randomDelay(Math.floor(stay * 0.4), stay);
    stats.viewed++;
    await browser.humanScroll(accountId, 'down', 400 + Math.random() * 300);
    stats.scrolled++;
  }

  return stats;
}

/**
 * 浏览指定标签（Hashtag）页面，强化账号地区/兴趣属性
 * @param {string} accountId
 * @param {string} hashtag - 标签名（不带#）
 * @param {Object} params
 * @param {number} params.scrollCount - 滚动次数
 * @param {number} params.minStay - 最少停留ms
 * @param {number} params.maxStay - 最多停留ms
 * @returns {Object} { hashtag, scrolled, viewed }
 */
async function browseHashtag(accountId, hashtag, params = {}) {
  const config = {
    scrollCount: params.scrollCount || 6,
    minStay: params.minStay || 2000,
    maxStay: params.maxStay || 6000,
  };
  const stats = { hashtag, scrolled: 0, viewed: 0 };

  const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;
  await browser.safeGoto(accountId, url, 'domcontentloaded', 20000);
  await browser.randomDelay(2500, 4500);

  for (let i = 0; i < config.scrollCount; i++) {
    const stay = Math.floor(Math.random() * (config.maxStay - config.minStay)) + config.minStay;
    await browser.randomDelay(Math.floor(stay * 0.4), stay);
    stats.viewed++;
    await browser.humanScroll(accountId, 'down', 400 + Math.random() * 300);
    stats.scrolled++;
  }

  return stats;
}

/**
 * 根据地区偏好浏览多个热门标签
 * @param {string} accountId
 * @param {string} regionCode - 地区代码（HK/JP/US 等）或 'random'
 * @param {number} tagCount - 浏览几个标签
 * @returns {Object} { region, regionName, tags, totalScrolled }
 */
async function browseRegionTags(accountId, regionCode, tagCount = 3) {
  const region = regions.getRegionTags(regionCode);
  const tags = regions.getRandomTags(regionCode, tagCount);
  const stats = { region: region.code, regionName: region.name, tags: [], totalScrolled: 0 };

  for (const tag of tags) {
    const r = await browseHashtag(accountId, tag, { scrollCount: 4 });
    stats.tags.push(tag);
    stats.totalScrolled += r.scrolled;
    await browser.randomDelay(3000, 6000); // 标签间间隔
  }

  return stats;
}

/**
 * 随机点赞当前 Feed 中的帖子
 * @param {string} accountId
 * @param {Object} params
 * @param {number} params.likeProbability - 点赞概率 0-1
 * @param {number} params.maxLikes - 本次最多点赞数
 * @param {number} params.scrollRounds - 滚动多少轮来找帖子
 * @returns {Object} { liked, attempted, skipped }
 */
async function randomLikeFeed(accountId, params = {}) {
  const config = {
    likeProbability: params.likeProbability ?? 0.2,
    maxLikes: params.maxLikes || 5,
    scrollRounds: params.scrollRounds || 10,
  };
  const stats = { liked: 0, attempted: 0, skipped: 0 };

  await browser.safeGoto(accountId, SELECTORS.feed.url, 'domcontentloaded', 20000);
  await browser.randomDelay(2000, 3500);

  const { page } = browser.getInstance(accountId);

  for (let i = 0; i < config.scrollRounds && stats.liked < config.maxLikes; i++) {
    // 随机停留
    await browser.randomDelay(2000, 5000);

    // 随机决定是否点赞
    if (Math.random() < config.likeProbability) {
      stats.attempted++;
      // 先在页面中找到目标并打标记
      const marked = await page.evaluate((sel) => {
        const posts = document.querySelectorAll(sel.feed.postContainer);
        const visiblePosts = Array.from(posts).filter(p => {
          const rect = p.getBoundingClientRect();
          return rect.top > 0 && rect.top < window.innerHeight;
        });
        if (visiblePosts.length === 0) return false;
        const post = visiblePosts[Math.floor(Math.random() * visiblePosts.length)];
        const likeSvg = post.querySelector('svg[aria-label="赞"], svg[aria-label="Like"]');
        if (!likeSvg) return false;
        const btn = likeSvg.closest('div[role="button"], button');
        if (btn) { btn.setAttribute('data-warmup-like', '1'); return true; }
        return false;
      }, SELECTORS);

      if (marked) {
        await browser.humanClick(accountId, '[data-warmup-like="1"]');
        await page.evaluate(() => {
          document.querySelectorAll('[data-warmup-like="1"]').forEach(el => el.removeAttribute('data-warmup-like'));
        });
        stats.liked++;
        await browser.randomDelay(1000, 2500);
      } else {
        stats.skipped++;
      }
    }

    // 滚动
    await browser.humanScroll(accountId, 'down', 350 + Math.random() * 250);
  }

  return stats;
}

/**
 * 观看 Story（随机点击，观看5-15秒）
 * @param {string} accountId
 * @param {Object} params
 * @param {number} params.minWatch - 最少观看ms
 * @param {number} params.maxWatch - 最多观看ms
 * @param {number} params.maxStories - 最多看几个
 * @returns {Object} { watched, skipped }
 */
async function watchStories(accountId, params = {}) {
  const config = {
    minWatch: params.minWatch || 5000,
    maxWatch: params.maxWatch || 15000,
    maxStories: params.maxStories || 5,
  };
  const stats = { watched: 0, skipped: 0 };

  const { page } = browser.getInstance(accountId);
  await browser.safeGoto(accountId, SELECTORS.feed.url, 'domcontentloaded', 15000);
  await browser.randomDelay(2000, 3500);

  // 点击第一个 Story（真实鼠标）
  const clicked = await page.evaluate((sel) => {
    const stories = document.querySelectorAll(sel.story.firstStory);
    if (stories.length > 0) { stories[0].setAttribute('data-warmup-story', '1'); return true; }
    return false;
  }, SELECTORS);

  if (!clicked) return stats;
  await browser.humanClick(accountId, '[data-warmup-story="1"]');
  await page.evaluate(() => {
    document.querySelectorAll('[data-warmup-story="1"]').forEach(el => el.removeAttribute('data-warmup-story'));
  });
  await browser.randomDelay(2000, 3500);

  for (let i = 0; i < config.maxStories; i++) {
    const watching = await page.evaluate((sel) => {
      return document.querySelector(sel.story.storyContainer) !== null;
    }, SELECTORS);
    if (!watching) break;

    // 随机观看5-15秒
    const watchTime = Math.floor(Math.random() * (config.maxWatch - config.minWatch)) + config.minWatch;
    await browser.randomDelay(watchTime);
    stats.watched++;

    // 点击下一个（真实鼠标）
    await page.evaluate((sel) => {
      const next = document.querySelector(sel.story.storyNext);
      if (next) next.setAttribute('data-warmup-next', '1');
    }, SELECTORS);
    await browser.humanClick(accountId, '[data-warmup-next="1"]');
    await page.evaluate(() => {
      document.querySelectorAll('[data-warmup-next="1"]').forEach(el => el.removeAttribute('data-warmup-next'));
    });
    await browser.randomDelay(500, 1200);
  }

  // 关闭 Story（真实鼠标）
  try {
    await page.evaluate((sel) => {
      const close = document.querySelector(sel.story.storyClose);
      if (close) {
        const target = close.closest('button, div[role="button"]') || close;
        target.setAttribute('data-warmup-close', '1');
      }
    }, SELECTORS);
    await browser.humanClick(accountId, '[data-warmup-close="1"]');
    await page.evaluate(() => {
      document.querySelectorAll('[data-warmup-close="1"]').forEach(el => el.removeAttribute('data-warmup-close'));
    });
  } catch (e) {}

  return stats;
}

/**
 * 人性化停顿（休息时间，不做任何操作）
 * @param {number} minMs - 最少休息ms
 * @param {number} maxMs - 最多休息ms
 */
async function humanPause(minMs = 20000, maxMs = 40000) {
  const pause = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  await new Promise(r => setTimeout(r, pause));
  return Math.round(pause / 1000);
}

/**
 * 执行一场完整的养号 Session
 * @param {string} accountId
 * @param {Object} strategy - 养号策略参数
 * @param {number} strategy.durationMin - 总时长（分钟）
 * @param {boolean} strategy.enableLike - 是否启用点赞
 * @param {number} strategy.likeProbability - 点赞概率
 * @param {number} strategy.maxLikes - 最多点赞数
 * @param {boolean} strategy.enableStory - 是否观看Story
 * @param {number} strategy.storyCount - Story数量
 * @param {boolean} strategy.enableExplore - 是否浏览探索页
 * @param {number} strategy.pauseIntervalMin - 每隔多少分钟停顿一次
 * @param {number} strategy.pauseDurationSec - 每次停顿秒数
 * @returns {Object} 养号统计
 */
async function startWarmupSession(accountId, strategy = {}) {
  const config = {
    durationMin: strategy.durationMin || 15,
    enableLike: strategy.enableLike !== false,
    likeProbability: strategy.likeProbability ?? 0.2,
    maxLikes: strategy.maxLikes || 5,
    enableStory: strategy.enableStory !== false,
    storyCount: strategy.storyCount || 3,
    enableExplore: strategy.enableExplore !== false,
    enableRegionTags: strategy.enableRegionTags !== false, // 启用地区标签浏览
    region: strategy.region || 'random', // 地区代码：HK/JP/US/random
    regionTagCount: strategy.regionTagCount || 3, // 每次浏览几个标签
    pauseIntervalMin: strategy.pauseIntervalMin || 2,
    pauseDurationSec: strategy.pauseDurationSec || 30,
  };

  const stats = {
    feedScrolled: 0,
    feedViewed: 0,
    exploreScrolled: 0,
    liked: 0,
    storiesWatched: 0,
    hashtagsViewed: 0,
    region: null,
    regionName: null,
    regionTags: [],
    pauses: 0,
    totalPauseSec: 0,
    warnings: [],
    startTime: Date.now(),
  };

  const endTime = Date.now() + config.durationMin * 60 * 1000;
  let lastPause = Date.now();
  let phase = 'feed'; // feed -> hashtag -> like -> story -> explore 循环

  while (Date.now() < endTime) {
    try {
      // 检查是否需要人性化停顿
      const sincePause = Date.now() - lastPause;
      if (sincePause > config.pauseIntervalMin * 60 * 1000) {
        const pauseSec = await humanPause(config.pauseDurationSec * 1000 * 0.5, config.pauseDurationSec * 1000 * 1.5);
        stats.pauses++;
        stats.totalPauseSec += pauseSec;
        lastPause = Date.now();
        continue;
      }

      // 按阶段执行不同动作
      switch (phase) {
        case 'feed': {
          const r = await browseFeed(accountId, { scrollCount: 5, minStay: 3000, maxStay: 10000 });
          stats.feedScrolled += r.scrolled;
          stats.feedViewed += r.viewed;
          phase = config.enableRegionTags ? 'hashtag' : (config.enableLike ? 'like' : (config.enableExplore ? 'explore' : 'feed'));
          break;
        }
        case 'hashtag': {
          if (config.enableRegionTags) {
            const r = await browseRegionTags(accountId, config.region, config.regionTagCount);
            stats.hashtagsViewed += r.tags.length;
            stats.region = r.region;
            stats.regionName = r.regionName;
            stats.regionTags = [...new Set([...stats.regionTags, ...r.tags])];
          }
          phase = config.enableLike ? 'like' : (config.enableStory ? 'story' : (config.enableExplore ? 'explore' : 'feed'));
          break;
        }
        case 'like': {
          if (stats.liked < config.maxLikes) {
            const r = await randomLikeFeed(accountId, {
              likeProbability: config.likeProbability,
              maxLikes: config.maxLikes - stats.liked,
              scrollRounds: 5,
            });
            stats.liked += r.liked;
          }
          phase = config.enableStory ? 'story' : (config.enableExplore ? 'explore' : 'feed');
          break;
        }
        case 'story': {
          if (stats.storiesWatched < config.storyCount) {
            const r = await watchStories(accountId, { maxStories: 2 });
            stats.storiesWatched += r.watched;
          }
          phase = config.enableExplore ? 'explore' : 'feed';
          break;
        }
        case 'explore': {
          const r = await browseExplore(accountId, { scrollCount: 4 });
          stats.exploreScrolled += r.scrolled;
          phase = 'feed';
          break;
        }
      }

      // 动作间随机间隔
      await browser.randomDelay(2000, 5000);
    } catch (e) {
      stats.warnings.push(e.message);
      await browser.randomDelay(5000, 10000);
    }
  }

  stats.durationSec = Math.round((Date.now() - stats.startTime) / 1000);
  return stats;
}

module.exports = {
  browseFeed,
  browseExplore,
  browseHashtag,
  browseRegionTags,
  randomLikeFeed,
  watchStories,
  humanPause,
  startWarmupSession,
  EXPLORE_URL,
};
