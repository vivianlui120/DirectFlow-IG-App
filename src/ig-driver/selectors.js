/**
 * IG-Driver 选择器集中管理
 * IG 网页改版时，只需修改此文件中的选择器
 * 所有 Puppeteer 操作必须引用这里的选择器，禁止硬编码
 */
module.exports = {
  // ========== 登录页 ==========
  login: {
    url: 'https://www.instagram.com/accounts/login/',
    usernameInput: 'input[name="username"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    saveInfoBtn: 'button:has-text("保存信息")',
    notNowBtn: 'button:has-text("Not Now")',
    twoFactorInput: 'input[name="verificationCode"]',
    twoFactorConfirm: 'button:has-text("确认")',
  },

  // ========== 首页 / Feed ==========
  feed: {
    url: 'https://www.instagram.com/',
    postContainer: 'article',
    likeButton: 'article svg[aria-label="赞"], article svg[aria-label="Like"]',
    unlikeButton: 'article svg[aria-label="取消赞"], article svg[aria-label="Unlike"]',
    commentInput: 'article textarea',
    postImage: 'article img',
    nextPostBtn: 'svg[aria-label="下一个"], svg[aria-label="Next"]',
    storyRing: 'div[role="menuitem"] img',
    storyViewBtn: 'div[role="button"]:has(img)',
  },

  // ========== Story ==========
  story: {
    firstStory: 'div[role="menuitem"]:first-child',
    storyContainer: 'section[role="dialog"]',
    storyProgress: 'div[role="progressbar"]',
    storyNext: 'button[aria-label="下一个"], div[aria-label="下一个"]',
    storyClose: 'svg[aria-label="关闭"], svg[aria-label="Close"]',
    storyReplyInput: 'textarea[placeholder="回复消息..."]',
  },

  // ========== 个人主页 ==========
  profile: {
    url: 'https://www.instagram.com/{username}/',
    followersLink: 'a[href$="/followers/"]',
    followingLink: 'a[href$="/following/"]',
    followerItem: 'div[role="dialog"] div[role="button"]',
    followButton: 'button:has-text("关注"), button:has-text("Follow")',
    followingButton: 'button:has-text("已关注"), button:has-text("Following")',
    messageButton: 'button:has-text("发消息"), button:has-text("Message")',
  },

  // ========== 私信 ==========
  dm: {
    url: 'https://www.instagram.com/direct/inbox/',
    newMessageBtn: 'svg[aria-label="新消息"], svg[aria-label="New message"]',
    searchInput: 'input[placeholder="搜索..."]',
    userCheckbox: 'div[role="dialog"] input[type="checkbox"]',
    chatInput: 'textarea[placeholder="输入消息..."]',
    sendButton: 'button:has-text("发送")',
    conversationItem: 'div[role="button"]:has(img)',
    notifDenyBtn: 'button:has-text("不允许")',
    // 附件/图片上传按钮
    attachBtn: 'svg[aria-label="上传照片或视频"], svg[aria-label="Upload Photo or Video"]',
    attachInput: 'input[type="file"]',
  },

  // ========== 通用 ==========
  common: {
    body: 'body',
    modalClose: 'svg[aria-label="关闭"], svg[aria-label="Close"]',
    cookieAccept: 'button:has-text("允许所有 Cookie")',
    loadingIndicator: 'div[role="progressbar"]',
  },

  // ========== 检测登录状态 ==========
  auth: {
    loggedInIndicator: 'svg[aria-label="首页"], svg[aria-label="Home"]',
    loggedOutIndicator: 'input[name="username"]',
  },
};
