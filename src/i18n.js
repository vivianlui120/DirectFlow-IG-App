/**
 * 智连 IG / DirectFlow IG 国际化模块
 * 支持简体中文 / English 双语切换
 * 语言配置持久化到 localStorage
 */

const MESSAGES = {
  zh_CN: {
    // Tab 导航
    'tab.dashboard': '仪表盘',
    'tab.accounts': '账号管理',
    'tab.warmup': '智能养号',
    'tab.scraper': '获客采集',
    'tab.massdm': '群发系统',
    'tab.autoreply': '自动回复',
    'tab.settings': '设置',

    // 通用按钮
    'btn.save': '保存设置',
    'btn.start': '开始',
    'btn.stop': '停止',
    'btn.pause': '暂停',
    'btn.resume': '恢复',
    'btn.delete': '删除',
    'btn.edit': '编辑',
    'btn.add': '添加',
    'btn.refresh': '刷新',
    'btn.confirm': '确认',
    'btn.cancel': '取消',
    'btn.test': '测试',
    'btn.export': '导出 CSV',
    'btn.import': '批量导入',
    'btn.clear': '清空',
    'btn.login': '登录',
    'btn.launch': '启动浏览器',
    'btn.closeBrowser': '关闭浏览器',
    'btn.openIG': '打开 IG',
    'btn.addAccount': '添加账号',
    'btn.addTemplate': '添加话术',
    'btn.addImage': '添加图片',
    'btn.startMassDM': '开始群发',
    'btn.startScrape': '开始采集',
    'btn.stopScrape': '停止采集',
    'btn.startListen': '启动监听',
    'btn.stopListen': '停止监听',
    'btn.scanNow': '立即扫描一次',
    'btn.goMassDM': '去群发 →',
    'btn.regenerateFP': '换指纹',

    // 账号管理
    'accounts.title': '添加账号',
    'accounts.username': 'IG 用户名',
    'accounts.password': 'IG 密码',
    'accounts.twofa': '2FA 密钥（Base32）',
    'accounts.proxyHost': '代理 IP（独立 IP）',
    'accounts.proxyPort': '代理端口',
    'accounts.proxyUser': '代理账号',
    'accounts.proxyPass': '代理密码',
    'accounts.list': '账号列表',
    'accounts.proxy': '代理',
    'accounts.direct': '直连',
    'accounts.warmupDays': '养号',
    'accounts.health': '健康度',
    'accounts.fingerprint': '指纹',
    'accounts.running': '运行中',
    'accounts.inactive': '未启动',
    'accounts.2faConfigured': '2FA 自动验证已配置',
    'accounts.2faNotConfigured': '未配置 2FA 自动验证',
    'accounts.noAccount': '暂无账号，请先添加',
    'accounts.runtime': '运行时长',
    'accounts.inputUsername': '请输入 IG 用户名',

    // 智能养号
    'warmup.status': '养号未启动',
    'warmup.todayCount': '今日已养号',
    'warmup.totalAccounts': '总账号数',
    'warmup.avgDays': '平均养号天数',
    'warmup.strategy': '养号策略模式',
    'warmup.auto': '自动计划',
    'warmup.autoDesc': '按养号天数自动适配',
    'warmup.conservative': '保守模式',
    'warmup.conservativeDesc': '仅浏览 · 5 分钟',
    'warmup.standard': '标准模式',
    'warmup.standardDesc': '浏览 + 点赞 · 15 分钟',
    'warmup.regionPref': '养号地区偏好',
    'warmup.selectRegion': '选择养号内容地区',
    'warmup.randomCountry': '随机国家（每次随机切换）',
    'warmup.regionTip': '养号时自动浏览该地区的热门标签，强化账号地区属性。建议与代理 IP 国家一致。',
    'warmup.regionTip2': '提示：每个账号配置对应国家的代理 IP，IG 会根据 IP 地理位置推荐当地内容',
    'warmup.applyAll': '应用到所有账号',
    'warmup.schedule': '定时养号',
    'warmup.dailyTime': '每日时间',
    'warmup.duration': '时长（分钟）',
    'warmup.set': '设置',
    'warmup.unset': '取消',
    'warmup.scheduleTip': '设置后每天固定时间自动后台启动养号（需保持软件打开）',
    'warmup.single': '单账号养号',
    'warmup.selectAccount': '请选择账号',
    'warmup.startWarmup': '开始养号',
    'warmup.accountList': '账号',
    'warmup.days': '养号天数',
    'warmup.todayStatus': '今日状态',
    'warmup.healthScore': '健康度',
    'warmup.safetyLevel': '安全等级',
    'warmup.currentPlan': '当前计划',
    'warmup.realtimeLog': '实时养号日志',
    'warmup.waiting': '[系统] 等待养号任务启动...',

    // 获客采集
    'scraper.targetUser': '目标主页用户名',
    'scraper.targetUserPh': '例如：instagram',
    'scraper.collectType': '采集类型',
    'scraper.followers': '粉丝列表',
    'scraper.following': '关注列表',
    'scraper.postLikers': '帖子点赞者',
    'scraper.maxCount': '采集数量',
    'scraper.useAccount': '使用账号',
    'scraper.selectAccount': '请选择账号',
    'scraper.autoSave': '采集完成后自动写入数据库（去重）',
    'scraper.progress': '采集进度',
    'scraper.waiting': '等待开始',
    'scraper.collected': '已采集',
    'scraper.saved': '已入库',
    'scraper.skipped': '去重跳过',
    'scraper.target': '目标数',
    'scraper.preview': '采集结果预览',
    'scraper.noData': '暂无采集数据',
    'scraper.index': '#',
    'scraper.username': '用户名',
    'scraper.fullName': '全名',
    'scraper.source': '来源',
    'scraper.completed': '采集完成，共',
    'scraper.failed': '采集失败：',
    'scraper.inputTarget': '请输入目标主页用户名',
    'scraper.minCount': '采集数量至少 10 个',

    // 群发系统
    'massdm.templates': '话术模板（支持 Spin-Text）',
    'massdm.templatePh': '{你好|嗨|哈囉} {username}，很高兴认识你！{欢迎|期待}交流~',
    'massdm.syntaxTip': '语法：{选项1|选项2|选项3} 随机选一个；{username} 替换为目标用户名',
    'massdm.noTemplate': '暂无话术，请先添加',
    'massdm.images': '张图片（随机选1张发送）',
    'massdm.noImage': '未添加图片',
    'massdm.selectedImages': '已选',
    'massdm.accounts': '发送账号（多选）',
    'massdm.noAccount': '暂无账号，请先在「账号管理」添加',
    'massdm.dedupRule': '防重规则',
    'massdm.never': '永久不重发',
    'massdm.7d': '7 天冷却',
    'massdm.10d': '10 天冷却',
    'massdm.dedupOff': '关闭防重',
    'massdm.dailyLimit': '每账号每日上限：',
    'massdm.dailyLimit2': '条私信',
    'massdm.leads': '目标名单',
    'massdm.total': '总数',
    'massdm.pending': '待发',
    'massdm.sent': '已发',
    'massdm.failed': '失败',
    'massdm.importPh': '每行一个用户名，批量导入...',
    'massdm.console': '实时控制台',
    'massdm.noTemplateSelected': '请至少选择一个话术模板',
    'massdm.noAccountSelected': '请至少选择一个发送账号',

    // 自动回复
    'autoreply.control': '自动回复控制',
    'autoreply.startListen': '启动监听',
    'autoreply.stopListen': '停止监听',
    'autoreply.notStarted': '未启动',
    'autoreply.listening': '监听中',
    'autoreply.interval': '轮询间隔：',
    'autoreply.intervalTip': '群发运行时自动回复会暂停错开',
    'autoreply.rules': '关键字规则',
    'autoreply.keyword': '关键字',
    'autoreply.matchType': '匹配模式',
    'autoreply.contains': '包含匹配',
    'autoreply.exact': '精准匹配',
    'autoreply.fallback': '兜底回复',
    'autoreply.replyContent': '回复内容，多套用 ||| 分隔随机轮换',
    'autoreply.addRule': '添加规则',
    'autoreply.noRule': '暂无规则，请添加',
    'autoreply.inputReply': '请输入回复内容',
    'autoreply.inputKeyword': '请输入关键字',
    'autoreply.deleteRule': '删除此规则？',
    'autoreply.listenAccounts': '监听账号',
    'autoreply.logs': '自动回复日志',
    'autoreply.noLog': '暂无回复记录',
    'autoreply.startFailed': '启动失败: ',

    // 设置
    'settings.warmupParams': '智能养号参数',
    'settings.interval': '自动养号间隔（分钟）',
    'settings.feedScroll': '每次 Feed 滚动次数',
    'settings.likeProb': '点赞概率 (0-1)',
    'settings.storyCount': '每次看 Story 数量',
    'settings.minStay': '最少停留（毫秒）',
    'settings.maxStay': '最多停留（毫秒）',
    'settings.save': '保存设置',
    'settings.defaultProxy': '默认代理配置',
    'settings.proxyIP': '默认代理 IP',
    'settings.proxyPort': '默认代理端口',
    'settings.proxyUser': '默认代理账号',
    'settings.proxyPass': '默认代理密码',
    'settings.optional': '可选',
    'settings.architecture': '架构信息',
    'settings.driverLayer': '驱动层',
    'settings.businessLayer': '业务层',
    'settings.language': '语言 / Language',

    // 仪表盘
    'dashboard.architecture': '双层解耦架构',
    'dashboard.archDesc': '主业务逻辑（数据库 / 任务调度 / 养号引擎）位于，所有 Puppeteer 网页操作与 DOM 选择器集中于。IG 改版只需修改驱动层。所有自动化任务默认 headless 静默运行，无浏览器弹窗。',
    'dashboard.totalAccounts': '总账号数',
    'dashboard.activeAccounts': '活跃账号',
    'dashboard.todaySent': '今日已发送',
    'dashboard.totalLikes': '累计点赞',
    'dashboard.warmupLevel': '养号等级',
    'dashboard.avgWeight': '平均权重 / 10',
    'dashboard.recentLogs': '最近养号记录',
    'dashboard.noLogs': '暂无记录',

    // 状态
    'status.active': '正常',
    'status.inactive': '未激活',
    'status.warming': '养号中',
    'status.error': '异常',
    'status.banned': '封禁',
    'status.need_2fa': '需验证',
    'status.login_failed': '登录失败',
    'status.daily_limit': '达上限',
    'status.restricted': '受限',
  },

  en_US: {
    // Tab Navigation
    'tab.dashboard': 'Dashboard',
    'tab.accounts': 'Accounts',
    'tab.warmup': 'Smart Warmup',
    'tab.scraper': 'Lead Scraper',
    'tab.massdm': 'Bulk DM',
    'tab.autoreply': 'Auto Reply',
    'tab.settings': 'Settings',

    // Common Buttons
    'btn.save': 'Save',
    'btn.start': 'Start',
    'btn.stop': 'Stop',
    'btn.pause': 'Pause',
    'btn.resume': 'Resume',
    'btn.delete': 'Delete',
    'btn.edit': 'Edit',
    'btn.add': 'Add',
    'btn.refresh': 'Refresh',
    'btn.confirm': 'Confirm',
    'btn.cancel': 'Cancel',
    'btn.test': 'Test',
    'btn.export': 'Export CSV',
    'btn.import': 'Batch Import',
    'btn.clear': 'Clear',
    'btn.login': 'Login',
    'btn.launch': 'Launch Browser',
    'btn.closeBrowser': 'Close Browser',
    'btn.openIG': 'Open IG',
    'btn.addAccount': 'Add Account',
    'btn.addTemplate': 'Add Template',
    'btn.addImage': 'Add Image',
    'btn.startMassDM': 'Start Bulk DM',
    'btn.startScrape': 'Start Scrape',
    'btn.stopScrape': 'Stop Scrape',
    'btn.startListen': 'Start Listening',
    'btn.stopListen': 'Stop Listening',
    'btn.scanNow': 'Scan Now',
    'btn.goMassDM': 'Go to Bulk DM →',
    'btn.regenerateFP': 'Regenerate',

    // Account Management
    'accounts.title': 'Add Account',
    'accounts.username': 'IG Username',
    'accounts.password': 'IG Password',
    'accounts.twofa': '2FA Secret (Base32)',
    'accounts.proxyHost': 'Proxy IP (Dedicated)',
    'accounts.proxyPort': 'Proxy Port',
    'accounts.proxyUser': 'Proxy User',
    'accounts.proxyPass': 'Proxy Pass',
    'accounts.list': 'Account List',
    'accounts.proxy': 'Proxy',
    'accounts.direct': 'Direct',
    'accounts.warmupDays': 'Warmup',
    'accounts.health': 'Health',
    'accounts.fingerprint': 'Fingerprint',
    'accounts.running': 'Running',
    'accounts.inactive': 'Stopped',
    'accounts.2faConfigured': '2FA Auto-Verify Enabled',
    'accounts.2faNotConfigured': '2FA Not Configured',
    'accounts.noAccount': 'No accounts yet, please add one',
    'accounts.runtime': 'Uptime',
    'accounts.inputUsername': 'Please enter IG username',

    // Smart Warmup
    'warmup.status': 'Warmup Not Started',
    'warmup.todayCount': 'Warmed Today',
    'warmup.totalAccounts': 'Total Accounts',
    'warmup.avgDays': 'Avg Warmup Days',
    'warmup.strategy': 'Warmup Strategy',
    'warmup.auto': 'Auto Plan',
    'warmup.autoDesc': 'Auto-adapt by warmup days',
    'warmup.conservative': 'Conservative',
    'warmup.conservativeDesc': 'Browse only · 5 min',
    'warmup.standard': 'Standard',
    'warmup.standardDesc': 'Browse + Like · 15 min',
    'warmup.regionPref': 'Warmup Region Preference',
    'warmup.selectRegion': 'Select warmup content region',
    'warmup.randomCountry': 'Random Country (rotate each time)',
    'warmup.regionTip': 'Auto-browse trending tags in this region during warmup. Recommended to match proxy IP country.',
    'warmup.regionTip2': 'Tip: Configure proxy IP per account matching its country; IG recommends local content based on IP geolocation.',
    'warmup.applyAll': 'Apply to All Accounts',
    'warmup.schedule': 'Scheduled Warmup',
    'warmup.dailyTime': 'Daily Time',
    'warmup.duration': 'Duration (min)',
    'warmup.set': 'Set',
    'warmup.unset': 'Clear',
    'warmup.scheduleTip': 'Auto warmup runs daily at set time (keep app open)',
    'warmup.single': 'Single Account Warmup',
    'warmup.selectAccount': 'Select account',
    'warmup.startWarmup': 'Start Warmup',
    'warmup.accountList': 'Account',
    'warmup.days': 'Days',
    'warmup.todayStatus': 'Today',
    'warmup.healthScore': 'Health',
    'warmup.safetyLevel': 'Safety',
    'warmup.currentPlan': 'Current Plan',
    'warmup.realtimeLog': 'Realtime Warmup Log',
    'warmup.waiting': '[System] Waiting for warmup task...',

    // Lead Scraper
    'scraper.targetUser': 'Target Profile Username',
    'scraper.targetUserPh': 'e.g. instagram',
    'scraper.collectType': 'Collect Type',
    'scraper.followers': 'Followers',
    'scraper.following': 'Following',
    'scraper.postLikers': 'Post Likers',
    'scraper.maxCount': 'Max Count',
    'scraper.useAccount': 'Use Account',
    'scraper.selectAccount': 'Select account',
    'scraper.autoSave': 'Auto-save to database after scrape (dedup)',
    'scraper.progress': 'Scrape Progress',
    'scraper.waiting': 'Waiting',
    'scraper.collected': 'Collected',
    'scraper.saved': 'Saved',
    'scraper.skipped': 'Skipped',
    'scraper.target': 'Target',
    'scraper.preview': 'Scrape Result Preview',
    'scraper.noData': 'No data yet',
    'scraper.index': '#',
    'scraper.username': 'Username',
    'scraper.fullName': 'Full Name',
    'scraper.source': 'Source',
    'scraper.completed': 'Scrape completed, total',
    'scraper.failed': 'Scrape failed: ',
    'scraper.inputTarget': 'Please enter target username',
    'scraper.minCount': 'Min count is 10',

    // Bulk DM
    'massdm.templates': 'Message Templates (Spin-Text)',
    'massdm.templatePh': '{Hi|Hello|Hey} {username}, nice to meet you!',
    'massdm.syntaxTip': 'Syntax: {opt1|opt2|opt3} random pick; {username} replaced with target name',
    'massdm.noTemplate': 'No templates yet, please add one',
    'massdm.images': ' image(s) (random pick 1)',
    'massdm.noImage': 'No image',
    'massdm.selectedImages': 'Selected',
    'massdm.accounts': 'Sender Accounts (multi-select)',
    'massdm.noAccount': 'No accounts, please add in Accounts tab',
    'massdm.dedupRule': 'Dedup Rule',
    'massdm.never': 'Never resend',
    'massdm.7d': '7-day cooldown',
    'massdm.10d': '10-day cooldown',
    'massdm.dedupOff': 'Off',
    'massdm.dailyLimit': 'Daily limit per account: ',
    'massdm.dailyLimit2': ' DMs',
    'massdm.leads': 'Target Leads',
    'massdm.total': 'Total',
    'massdm.pending': 'Pending',
    'massdm.sent': 'Sent',
    'massdm.failed': 'Failed',
    'massdm.importPh': 'One username per line, batch import...',
    'massdm.console': 'Realtime Console',
    'massdm.noTemplateSelected': 'Please select at least one template',
    'massdm.noAccountSelected': 'Please select at least one sender account',

    // Auto Reply
    'autoreply.control': 'Auto Reply Control',
    'autoreply.startListen': 'Start Listening',
    'autoreply.stopListen': 'Stop Listening',
    'autoreply.notStarted': 'Not started',
    'autoreply.listening': 'Listening',
    'autoreply.interval': 'Poll interval: ',
    'autoreply.intervalTip': 'Auto-reply pauses when bulk DM is running',
    'autoreply.rules': 'Keyword Rules',
    'autoreply.keyword': 'Keyword',
    'autoreply.matchType': 'Match Type',
    'autoreply.contains': 'Contains',
    'autoreply.exact': 'Exact Match',
    'autoreply.fallback': 'Fallback Reply',
    'autoreply.replyContent': 'Reply content, separate multiple with ||| for random rotation',
    'autoreply.addRule': 'Add Rule',
    'autoreply.noRule': 'No rules yet, please add one',
    'autoreply.inputReply': 'Please enter reply content',
    'autoreply.inputKeyword': 'Please enter keyword',
    'autoreply.deleteRule': 'Delete this rule?',
    'autoreply.listenAccounts': 'Listening Accounts',
    'autoreply.logs': 'Auto Reply Logs',
    'autoreply.noLog': 'No reply records yet',
    'autoreply.startFailed': 'Start failed: ',

    // Settings
    'settings.warmupParams': 'Smart Warmup Parameters',
    'settings.interval': 'Auto Warmup Interval (min)',
    'settings.feedScroll': 'Feed Scroll Count',
    'settings.likeProb': 'Like Probability (0-1)',
    'settings.storyCount': 'Story Count per Session',
    'settings.minStay': 'Min Stay (ms)',
    'settings.maxStay': 'Max Stay (ms)',
    'settings.save': 'Save Settings',
    'settings.defaultProxy': 'Default Proxy Config',
    'settings.proxyIP': 'Default Proxy IP',
    'settings.proxyPort': 'Default Proxy Port',
    'settings.proxyUser': 'Default Proxy User',
    'settings.proxyPass': 'Default Proxy Pass',
    'settings.optional': 'Optional',
    'settings.architecture': 'Architecture Info',
    'settings.driverLayer': 'Driver Layer',
    'settings.businessLayer': 'Business Layer',
    'settings.language': 'Language / 语言',

    // Dashboard
    'dashboard.architecture': 'Dual-Layer Decoupled Architecture',
    'dashboard.archDesc': 'Core business logic (DB / scheduler / warmup engine) resides in, all Puppeteer operations and DOM selectors are centralized in. IG UI changes only require driver-layer updates. All automation tasks run headless by default, no browser popups.',
    'dashboard.totalAccounts': 'Total Accounts',
    'dashboard.activeAccounts': 'Active Accounts',
    'dashboard.todaySent': 'Sent Today',
    'dashboard.totalLikes': 'Total Likes',
    'dashboard.warmupLevel': 'Warmup Level',
    'dashboard.avgWeight': 'Avg Weight / 10',
    'dashboard.recentLogs': 'Recent Warmup Logs',
    'dashboard.noLogs': 'No records',

    // Status
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.warming': 'Warming',
    'status.error': 'Error',
    'status.banned': 'Banned',
    'status.need_2fa': 'Need 2FA',
    'status.login_failed': 'Login Failed',
    'status.daily_limit': 'Daily Limit',
    'status.restricted': 'Restricted',
  }
};

// 当前语言
let currentLang = 'zh_CN';

/**
 * 初始化语言：优先 localStorage，其次系统语言，默认中文
 */
function initLang() {
  try {
    const stored = localStorage.getItem('app_lang');
    if (stored && MESSAGES[stored]) {
      currentLang = stored;
      return;
    }
  } catch (e) {}
  // 系统语言判断
  const sysLang = (navigator.language || 'zh-CN').toLowerCase();
  currentLang = sysLang.startsWith('en') ? 'en_US' : 'zh_CN';
}

/**
 * 获取当前语言
 */
function getLang() {
  return currentLang;
}

/**
 * 设置语言并持久化
 */
function setLang(lang) {
  if (!MESSAGES[lang]) return false;
  currentLang = lang;
  try { localStorage.setItem('app_lang', lang); } catch (e) {}
  return true;
}

/**
 * 翻译函数
 */
function t(key) {
  const dict = MESSAGES[currentLang] || MESSAGES.zh_CN;
  return dict[key] || key;
}

/**
 * 批量翻译页面中所有带 data-i18n 属性的元素
 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  // 翻译 placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    el.placeholder = t(key);
  });
  // 翻译 title 属性
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });
}

// 自动初始化
initLang();

// 暴露到全局
window.i18n = { t, setLang, getLang, initLang, applyI18n, MESSAGES };
