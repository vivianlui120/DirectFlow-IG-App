/**
 * IG-Driver 自动化驱动层入口
 * 所有 Puppeteer 网页操作与 DOM 选择器集中在此目录
 * 主业务逻辑层只能通过此入口调用，禁止直接操作 Puppeteer
 *
 * 架构原则：
 * - IG 改版只需修改本目录（主要是 selectors.js）
 * - 所有任务默认 headless 静默运行
 * - 模拟真人操作节奏，防风控
 */
const browser = require('./browser');
const login = require('./login');
const feed = require('./feed');
const story = require('./story');
const dm = require('./dm');
const warmup = require('./warmup');
const scraper = require('./scraper');
const totp = require('./totp');
const regions = require('./regions');
const autoReply = require('./auto_reply');
const SELECTORS = require('./selectors');

module.exports = {
  // 浏览器管理
  launch: browser.launch,
  close: browser.close,
  closeAll: browser.closeAll,
  getInstance: browser.getInstance,
  listInstances: browser.listInstances,
  safeGoto: browser.safeGoto,
  randomDelay: browser.randomDelay,
  humanScroll: browser.humanScroll,
  humanClick: browser.humanClick,
  humanClickAt: browser.humanClickAt,
  humanMoveTo: browser.humanMoveTo,
  generateFingerprint: browser.generateFingerprint,
  detectBrowser: browser.detectBrowser,

  // 登录
  login: login.login,
  isLoggedIn: login.isLoggedIn,
  openLoginPage: login.openLoginPage,
  submit2FA: login.submit2FA,

  // Feed
  openFeed: feed.openFeed,
  browseFeed: feed.browseFeed,
  likePost: feed.likePost,
  viewPost: feed.viewPost,
  getPostCount: feed.getPostCount,

  // Story
  watchStories: story.watchStories,
  openFirstStory: story.openFirstStory,
  getAvailableStoryCount: story.getAvailableStoryCount,

  // DM 私信
  sendDM: dm.sendDM,
  cooldownAfterSend: dm.cooldownAfterSend,
  checkDMAbility: dm.checkDMAbility,

  // 养号驱动
  startWarmupSession: warmup.startWarmupSession,
  browseFeed: warmup.browseFeed,
  browseExplore: warmup.browseExplore,
  randomLikeFeed: warmup.randomLikeFeed,
  watchStoriesWarmup: warmup.watchStories,
  humanPause: warmup.humanPause,

  // 名单采集驱动
  fetchFollowers: scraper.fetchFollowers,
  fetchPostLikers: scraper.fetchPostLikers,
  stopScrape: scraper.requestStop,

  // TOTP 2FA 工具
  generateTOTP: totp.generateTOTP,
  verifyTOTP: totp.verifyTOTP,
  getTOTPRemaining: totp.getRemainingSeconds,

  // 地区标签库
  getRegionTags: regions.getRegionTags,
  getRandomRegionTags: regions.getRandomTags,
  getRegionOptions: regions.getRegionOptions,

  // 自动回复
  checkInboxAndReply: autoReply.checkInboxAndReply,

  // 选择器（供外部参考，禁止直接使用操作）
  SELECTORS,
};
