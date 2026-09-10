/**
 * IG-Driver 浏览器实例管理
 * 负责：浏览器启动/关闭、代理配置、会话持久化、UA伪装、指纹注入、真人鼠标模拟
 * 所有 Puppeteer 操作只在此层
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SELECTORS = require('./selectors');
const Socks5HttpProxy = require('./socks-proxy');

// 实例存储
const instances = new Map();

// UA 池（模拟真实 Windows Chrome 不同版本）
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

// 屏幕分辨率池
const VIEWPORT_POOL = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1600, height: 900 },
];

// 语言池
const LANG_POOL = [
  { lang: 'zh-CN', langs: ['zh-CN', 'zh', 'en'], accept: 'zh-CN,zh;q=0.9,en;q=0.8' },
  { lang: 'en-US', langs: ['en-US', 'en'], accept: 'en-US,en;q=0.9' },
  { lang: 'zh-TW', langs: ['zh-TW', 'zh', 'en'], accept: 'zh-TW,zh;q=0.9,en;q=0.8' },
  { lang: 'ja-JP', langs: ['ja-JP', 'ja', 'en'], accept: 'ja-JP,ja;q=0.9,en;q=0.8' },
  { lang: 'ko-KR', langs: ['ko-KR', 'ko', 'en'], accept: 'ko-KR,ko;q=0.9,en;q=0.8' },
];

// 时区池
const TIMEZONE_POOL = ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];

// WebGL 厂商池
const WEBGL_VENDORS = ['Google Inc. (Intel)', 'Google Inc. (NVIDIA)', 'Google Inc. (AMD)', 'Intel Inc.'];
const WEBGL_RENDERERS = [
  'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
  'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
];

// 会话根目录
function getSessionRoot() {
  const dir = path.join(os.tmpdir(), 'igdm-sessions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 检测系统浏览器
function detectBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 生成唯一浏览器指纹
 * 每个账号绑定一个固定指纹，持久化存储，确保IG看到的是同一台设备
 */
function generateFingerprint() {
  const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
  const viewport = VIEWPORT_POOL[Math.floor(Math.random() * VIEWPORT_POOL.length)];
  const langPack = LANG_POOL[Math.floor(Math.random() * LANG_POOL.length)];
  const timezone = TIMEZONE_POOL[Math.floor(Math.random() * TIMEZONE_POOL.length)];
  const webglVendor = WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)];
  const webglRenderer = WEBGL_RENDERERS[Math.floor(Math.random() * WEBGL_RENDERERS.length)];
  const isMac = ua.includes('Macintosh');

  return {
    userAgent: ua,
    viewport,
    language: langPack.lang,
    languages: langPack.langs,
    acceptLanguage: langPack.accept,
    platform: isMac ? 'MacIntel' : 'Win32',
    timezone,
    hardwareConcurrency: [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)],
    deviceMemory: [4, 8, 16][Math.floor(Math.random() * 3)],
    webglVendor,
    webglRenderer,
    canvasSeed: Math.random().toString(36).substring(2, 15),
    colorDepth: 24,
    pixelRatio: [1, 1.25, 1.5][Math.floor(Math.random() * 3)],
    touchSupport: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 注入指纹到页面
 * 在 evaluateOnNewDocument 中执行，覆盖所有原生属性
 */
function buildFingerprintInjectionScript(fp) {
  return `
    (function() {
      // 1. User-Agent
      Object.defineProperty(navigator, 'userAgent', { get: () => '${fp.userAgent}' });
      Object.defineProperty(navigator, 'appVersion', { get: () => '${fp.userAgent.replace('Mozilla/', '')}' });

      // 2. 语言
      Object.defineProperty(navigator, 'language', { get: () => '${fp.language}' });
      Object.defineProperty(navigator, 'languages', { get: () => ${JSON.stringify(fp.languages)} });

      // 3. 平台
      Object.defineProperty(navigator, 'platform', { get: () => '${fp.platform}' });

      // 4. 硬件信息
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${fp.hardwareConcurrency} });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => ${fp.deviceMemory} });

      // 5. 屏幕
      Object.defineProperty(screen, 'width', { get: () => ${fp.viewport.width} });
      Object.defineProperty(screen, 'height', { get: () => ${fp.viewport.height} });
      Object.defineProperty(screen, 'availWidth', { get: () => ${fp.viewport.width} });
      Object.defineProperty(screen, 'availHeight', { get: () => ${fp.viewport.height - 40} });
      Object.defineProperty(screen, 'colorDepth', { get: () => ${fp.colorDepth} });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${fp.colorDepth} });

      // 6. 时区
      const originalDateTimeFormat = Intl.DateTimeFormat;
      const originalResolve = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function() {
        const opts = originalResolve.call(this);
        opts.timeZone = '${fp.timezone}';
        return opts;
      };
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      const tzOffsets = {
        'Asia/Shanghai': -480, 'Asia/Hong_Kong': -480, 'Asia/Taipei': -480,
        'Asia/Tokyo': -540, 'Asia/Seoul': -540,
        'America/New_York': 300, 'America/Los_Angeles': 480, 'Europe/London': 0
      };
      Date.prototype.getTimezoneOffset = function() {
        return tzOffsets['${fp.timezone}'] !== undefined ? tzOffsets['${fp.timezone}'] : originalGetTimezoneOffset.call(this);
      };

      // 7. Canvas 指纹污染
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const canvasSeed = '${fp.canvasSeed}';
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        const ctx = originalGetContext.call(this, type, attrs);
        if (type === '2d' && ctx) {
          const originalFillText = ctx.fillText;
          ctx.fillText = function(text, x, y) {
            const noise = canvasSeed.charCodeAt(text.length % canvasSeed.length) * 0.01;
            ctx.save();
            ctx.globalAlpha = 0.01;
            ctx.fillStyle = 'rgba(0,0,0,0.01)';
            originalFillText.call(ctx, canvasSeed, x + noise, y + noise);
            ctx.restore();
            return originalFillText.call(this, text, x, y);
          };
        }
        return ctx;
      };
      HTMLCanvasElement.prototype.toDataURL = function() {
        const ctx = this.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.globalAlpha = 0.01;
          ctx.fillStyle = 'rgba(0,0,0,0.01)';
          ctx.fillText(canvasSeed, 0, 10);
          ctx.restore();
        }
        return originalToDataURL.apply(this, arguments);
      };

      // 8. WebGL 指纹污染
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return '${fp.webglVendor}'; // UNMASKED_VENDOR_WEBGL
        if (parameter === 37446) return '${fp.webglRenderer}'; // UNMASKED_RENDERER_WEBGL
        return originalGetParameter.call(this, parameter);
      };
      if (window.WebGL2RenderingContext) {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return '${fp.webglVendor}';
          if (parameter === 37446) return '${fp.webglRenderer}';
          return originalGetParameter2.call(this, parameter);
        };
      }

      // 9. 隐藏自动化特征
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

      // 10. 权限查询伪装
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(parameters) {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return originalQuery.call(this, parameters);
      };
    })();
  `;
}

/**
 * 启动浏览器实例
 * @param {Object} config
 * @param {string} config.accountId - 账号ID（用于会话目录隔离）
 * @param {string} config.proxyHost - 代理IP
 * @param {number} config.proxyPort - 代理端口
 * @param {string} config.proxyUser - 代理账号
 * @param {string} config.proxyPass - 代理密码
 * @param {Object} config.fingerprint - 浏览器指纹（由db层生成并持久化）
 * @param {boolean} config.headless - 是否无头模式（默认true，静默运行）
 */
async function launch(config = {}) {
  const accountId = config.accountId || ('acc_' + Date.now());
  const executablePath = config.executablePath || detectBrowser();
  if (!executablePath) throw new Error('未检测到 Chrome/Edge 浏览器');

  // 每个账号独立会话目录，持久化登录态
  const userDataDir = path.join(getSessionRoot(), accountId);
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  // 指纹（优先使用传入的，否则生成新的）
  const fingerprint = config.fingerprint || generateFingerprint();

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    `--user-data-dir=${userDataDir}`,
    '--mute-audio',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--disable-translate',
    '--disable-features=TranslateUI',
    '--metrics-recording-only',
    '--no-pings',
    '--safebrowsing-disable-auto-update',
    '--disable-software-rasterizer',
    // 时区匹配指纹
    `--timezone=${fingerprint.timezone}`,
  ];

  let proxyServer = null;
  let socksProxy = null;
  // 兼容：如果代理IP里带 socks5:// 前缀，自动识别为 Socks5
  let proxyType = config.proxyType;
  let proxyHost = config.proxyHost;
  if (proxyHost && proxyHost.startsWith('socks5://')) {
    proxyType = 'socks5';
    proxyHost = proxyHost.replace('socks5://', '');
  }
  console.log(`[browser] 代理配置: type=${proxyType}, host=${proxyHost}, port=${config.proxyPort}, hasUser=${!!config.proxyUser}, hasPass=${!!config.proxyPass}`);
  if (proxyHost && config.proxyPort) {
    if (proxyType === 'socks5' && config.proxyUser && config.proxyPass) {
      // Socks5 带认证：启动本地 HTTP 代理转发
      socksProxy = new Socks5HttpProxy(proxyHost, config.proxyPort, config.proxyUser, config.proxyPass);
      const localPort = await socksProxy.start();
      proxyServer = `127.0.0.1:${localPort}`;
      console.log(`[browser] Socks5代理已转本地HTTP: ${proxyServer}`);
    } else {
      const proxyProtocol = proxyType === 'socks5' ? 'socks5://' : '';
      proxyServer = `${proxyProtocol}${proxyHost}:${config.proxyPort}`;
    }
    args.push(`--proxy-server=${proxyServer}`);
  }

  let browser;
  try {
    console.log(`[browser] 启动浏览器: ${executablePath}`);
    console.log(`[browser] 代理: ${proxyServer || '直连'}`);
    console.log(`[browser] UserDataDir: ${userDataDir}`);
    browser = await puppeteer.launch({
      executablePath,
      headless: config.headless === false ? false : 'new',
      args,
      defaultViewport: {
        width: fingerprint.viewport.width,
        height: fingerprint.viewport.height,
        deviceScaleFactor: fingerprint.pixelRatio,
      },
      ignoreHTTPSErrors: true,
      timeout: 30000,
      dumpio: false,
    });
    console.log(`[browser] 启动成功`);
  } catch (e) {
    const errMsg = e.message || e.toString() || '未知错误';
    console.error(`[browser] 启动失败:`, e);
    throw new Error(`浏览器启动失败: ${errMsg} (Chrome路径: ${executablePath}, 代理: ${proxyServer || '直连'})`);
  }

  const page = await browser.newPage();

  // 代理认证
  if (proxyServer && config.proxyUser && config.proxyPass) {
    await page.authenticate({ username: config.proxyUser, password: config.proxyPass });
  }

  // 设置 UA
  await page.setUserAgent(fingerprint.userAgent);

  // 设置 Accept-Language
  await page.setExtraHTTPHeaders({ 'Accept-Language': fingerprint.acceptLanguage });

  // 注入指纹（在每个新文档执行前）
  await page.evaluateOnNewDocument(buildFingerprintInjectionScript(fingerprint));

  // 记录当前鼠标位置（用于轨迹计算）
  const mouseState = { x: fingerprint.viewport.width / 2, y: fingerprint.viewport.height / 2 };

  const instance = {
    id: accountId,
    browser,
    page,
    config: { ...config, userDataDir, proxyServer, fingerprint, socksProxy },
    mouseState,
    createdAt: Date.now(),
  };

  instances.set(accountId, instance);
  return { accountId, proxy: proxyServer || '直连', userDataDir, fingerprint };
}

/**
 * 关闭实例
 */
async function close(accountId) {
  const inst = instances.get(accountId);
  if (inst) {
    try { await inst.browser.close(); } catch (e) {}
    if (inst.config.socksProxy) {
      try { inst.config.socksProxy.stop(); } catch (e) {}
      console.log(`[browser] 已停止本地Socks5代理`);
    }
    instances.delete(accountId);
  }
  return true;
}

async function closeAll() {
  for (const id of instances.keys()) await close(id);
  return true;
}

function getInstance(accountId) {
  const inst = instances.get(accountId);
  if (!inst) throw new Error('浏览器实例不存在: ' + accountId);
  return inst;
}

function listInstances() {
  const list = [];
  for (const [id, inst] of instances.entries()) {
    list.push({
      accountId: id,
      proxy: inst.config.proxyServer || '直连',
      headless: true,
      url: inst.page.url(),
      uptime: Math.floor((Date.now() - inst.createdAt) / 1000),
    });
  }
  return list;
}

/**
 * 安全导航（带超时和重试）
 */
async function safeGoto(accountId, url, waitUntil = 'networkidle2', timeout = 30000) {
  const { page } = getInstance(accountId);
  console.log(`[browser] 打开页面: ${url}`);
  try {
    await page.goto(url, { waitUntil, timeout });
    const title = await page.title();
    const currentUrl = page.url();
    console.log(`[browser] 页面加载成功: ${title} (${currentUrl})`);
    return title;
  } catch (e) {
    const currentUrl = page.url();
    console.error(`[browser] 页面加载失败: ${e.message} (当前URL: ${currentUrl})`);
    throw e;
  }
}

/**
 * 随机延时（模拟真人）
 */
function randomDelay(min = 1000, max = 3000) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

/**
 * 贝塞尔曲线插值（生成真人鼠标轨迹）
 */
function bezierCurve(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * 生成从起点到终点的贝塞尔曲线路径点
 * 控制点随机偏移，模拟真人鼠标的不规则轨迹
 */
function generateMousePath(from, to, steps = 20) {
  // 生成两个随机控制点
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const offset = Math.min(80, Math.sqrt(dx * dx + dy * dy) * 0.3);
  const p1 = {
    x: from.x + dx * 0.3 + (Math.random() - 0.5) * offset,
    y: from.y + dy * 0.3 + (Math.random() - 0.5) * offset,
  };
  const p2 = {
    x: from.x + dx * 0.7 + (Math.random() - 0.5) * offset,
    y: from.y + dy * 0.7 + (Math.random() - 0.5) * offset,
  };

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // 加入微小抖动
    const jitter = i < steps ? (Math.random() - 0.5) * 2 : 0;
    const pt = bezierCurve(from, p1, p2, to, t);
    points.push({ x: Math.round(pt.x + jitter), y: Math.round(pt.y + jitter) });
  }
  return points;
}

/**
 * 真人鼠标移动：贝塞尔曲线轨迹 + 变速 + 微小抖动
 * @param {string} accountId
 * @param {number} targetX - 目标X坐标
 * @param {number} targetY - 目标Y坐标
 */
async function humanMoveTo(accountId, targetX, targetY) {
  const { page, mouseState } = getInstance(accountId);

  const from = { x: mouseState.x, y: mouseState.y };
  const to = { x: targetX, y: targetY };

  // 根据距离决定步数
  const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
  const steps = Math.max(8, Math.min(30, Math.floor(dist / 15)));

  const path = generateMousePath(from, to, steps);

  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    await page.mouse.move(pt.x, pt.y);
    // 变速：中间快，两端慢（模拟真人鼠标加减速）
    const progress = i / path.length;
    const speedFactor = Math.sin(progress * Math.PI); // 0->1->0 的钟形曲线
    const delay = 2 + Math.random() * 6 * (1 - speedFactor * 0.7);
    await new Promise(r => setTimeout(r, delay));
  }

  // 更新鼠标状态
  mouseState.x = targetX;
  mouseState.y = targetY;
}

/**
 * 真人点击：移动到目标 + 微小偏移 + mousedown + 停顿 + mouseup
 * @param {string} accountId
 * @param {number} x - 点击X坐标
 * @param {number} y - 点击Y坐标
 */
async function humanClickAt(accountId, x, y) {
  const { page } = getInstance(accountId);

  // 移动到目标附近（有微小偏移，不精确命中中心）
  const clickX = x + Math.round((Math.random() - 0.5) * 6);
  const clickY = y + Math.round((Math.random() - 0.5) * 6);
  await humanMoveTo(accountId, clickX, clickY);

  // 点击前微小停顿（模拟犹豫）
  await randomDelay(50, 200);

  // mousedown
  await page.mouse.down();
  // 按下后停顿（真人按住的时间）
  await randomDelay(40, 120);
  // mouseup
  await page.mouse.up();

  // 点击后停顿
  await randomDelay(100, 300);
}

/**
 * 通过选择器获取元素中心坐标，然后真人点击
 * @param {string} accountId
 * @param {string} selector - CSS选择器
 * @param {number} [index=0] - 第几个匹配元素
 */
async function humanClick(accountId, selector, index = 0) {
  const { page } = getInstance(accountId);

  const box = await page.evaluate((sel, idx) => {
    const els = document.querySelectorAll(sel);
    if (!els[idx]) return null;
    const rect = els[idx].getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector, index);

  if (!box) {
    // 降级：用 page.click
    await page.click(selector);
    return false;
  }

  await humanClickAt(accountId, box.x, box.y);
  return true;
}

/**
 * 通过 JS 路径点击元素（用于复杂选择器）
 * @param {string} accountId
 * @param {Function} elementFinder - 在页面执行的函数，返回元素
 */
async function humanClickByEvaluate(accountId, elementFinder) {
  const { page } = getInstance(accountId);

  const box = await page.evaluate((fnStr) => {
    const fn = new Function('return (' + fnStr + ')()');
    const el = fn();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, elementFinder.toString());

  if (!box) return false;
  await humanClickAt(accountId, box.x, box.y);
  return true;
}

/**
 * 模拟真人滚动（使用鼠标滚轮事件，替代 window.scrollBy）
 */
async function humanScroll(accountId, direction = 'down', distance = 300) {
  const { page, mouseState } = getInstance(accountId);

  // 先移动鼠标到页面中间区域
  const targetX = mouseState.x + Math.round((Math.random() - 0.5) * 100);
  const targetY = Math.min(mouseState.y + 100, 500);
  await humanMoveTo(accountId, targetX, targetY);

  // 分段滚动，模拟多次滚轮
  const segments = Math.max(1, Math.floor(distance / 100));
  const perSegment = Math.round(distance / segments);
  const deltaY = direction === 'down' ? perSegment : -perSegment;

  for (let i = 0; i < segments; i++) {
    await page.mouse.wheel({ deltaY: deltaY + Math.round((Math.random() - 0.5) * 20) });
    await randomDelay(80, 200);
  }

  await randomDelay(300, 800);
}

/**
 * 注入 Cookies 到页面
 * @param {Object} page - Puppeteer page 对象
 * @param {string} cookiesStr - Cookies JSON 字符串或单个 cookie 字符串
 * @returns {boolean} 是否成功注入
 */
async function injectCookies(page, cookiesStr) {
  if (!cookiesStr || !cookiesStr.trim()) return false;

  try {
    let cookies = [];

    // 尝试解析为 JSON 数组
    try {
      const parsed = JSON.parse(cookiesStr);
      if (Array.isArray(parsed)) {
        cookies = parsed;
      } else if (typeof parsed === 'object') {
        cookies = [parsed];
      }
    } catch (e) {
      // 不是 JSON，尝试解析为 name=value; name2=value2 格式
      const pairs = cookiesStr.split(';').map(s => s.trim()).filter(Boolean);
      for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          cookies.push({
            name: pair.substring(0, eqIdx).trim(),
            value: pair.substring(eqIdx + 1).trim(),
            domain: '.instagram.com',
          });
        }
      }
    }

    if (cookies.length === 0) return false;

    // 确保每个 cookie 有 domain
    const normalizedCookies = cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.instagram.com',
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure || true,
      sameSite: c.sameSite || 'Lax',
      expires: c.expires || -1,
    }));

    // 先导航到 instagram.com（setCookie 需要页面在对应域名下）
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 注入 cookies
    await page.setCookie(...normalizedCookies);

    // 刷新页面使 cookies 生效
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

    return true;
  } catch (e) {
    console.error('Cookies 注入失败:', e.message);
    return false;
  }
}

module.exports = {
  launch, close, closeAll, getInstance, listInstances,
  safeGoto, randomDelay, humanScroll, detectBrowser,
  humanMoveTo, humanClick, humanClickAt, humanClickByEvaluate,
  generateFingerprint, buildFingerprintInjectionScript,
  injectCookies,
  SELECTORS,
};
