/**
 * IG-Driver 登录模块
 * 负责：打开登录页、输入账号密码、自动2FA验证、检测登录状态
 */
const browser = require('./browser');
const totp = require('./totp');
const SELECTORS = browser.SELECTORS;

/**
 * 打开登录页
 */
async function openLoginPage(accountId) {
  return await browser.safeGoto(accountId, SELECTORS.login.url);
}

/**
 * 输入账号密码并提交
 */
async function fillAndSubmit(accountId, username, password) {
  const { page } = browser.getInstance(accountId);

  // 先检查是否已经登录（Cookies 有效时可能已自动登录）
  const alreadyLoggedIn = await page.evaluate((sel) => {
    return document.querySelector(sel) !== null;
  }, SELECTORS.auth.loggedInIndicator).catch(() => false);

  if (alreadyLoggedIn) {
    console.log(`[${accountId}] 检测到已登录状态，跳过账号密码输入`);
    return true;
  }

  // 等待用户名输入框
  try {
    await page.waitForSelector(SELECTORS.login.usernameInput, { timeout: 30000 });
  } catch (e) {
    // 输出当前页面信息，方便排查
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unknown');
    console.error(`[${accountId}] 登录页加载失败，当前URL: ${currentUrl}, 标题: ${pageTitle}`);
    throw new Error(`登录页加载失败（当前页面: ${pageTitle}），请检查网络或代理`);
  }

  await browser.randomDelay(800, 1500);

  // 输入用户名（模拟真人打字速度）
  await page.type(SELECTORS.login.usernameInput, username, { delay: 80 + Math.random() * 60 });
  await browser.randomDelay(500, 1200);

  // 输入密码
  await page.type(SELECTORS.login.passwordInput, password, { delay: 70 + Math.random() * 50 });
  await browser.randomDelay(600, 1200);

  // 点击登录（真实鼠标）
  await browser.humanClick(accountId, SELECTORS.login.submitButton);
  await browser.randomDelay(2000, 4000);

  return true;
}

/**
 * 处理登录后的弹窗（保存信息、通知等）
 */
async function handlePostLoginPopups(accountId) {
  const { page } = browser.getInstance(accountId);
  await browser.randomDelay(2000, 3500);

  // 尝试点击"保存信息"
  try {
    await page.waitForSelector(SELECTORS.login.saveInfoBtn, { timeout: 5000 });
    await browser.humanClick(accountId, SELECTORS.login.saveInfoBtn);
    await browser.randomDelay(1000, 2000);
  } catch (e) { /* 没有弹窗就跳过 */ }

  // 尝试点击"Not Now"（通知弹窗）
  try {
    await page.waitForSelector(SELECTORS.login.notNowBtn, { timeout: 5000 });
    await browser.humanClick(accountId, SELECTORS.login.notNowBtn);
  } catch (e) { /* 没有弹窗就跳过 */ }

  return true;
}

/**
 * 检测是否已登录
 */
async function isLoggedIn(accountId) {
  const { page } = browser.getInstance(accountId);
  try {
    // 导航到首页
    await browser.safeGoto(accountId, SELECTORS.feed.url, 'domcontentloaded', 15000);
    await browser.randomDelay(1500, 2500);

    // 检测登录指示器
    const loggedIn = await page.evaluate((sel) => {
      return document.querySelector(sel) !== null;
    }, SELECTORS.auth.loggedInIndicator);

    return loggedIn;
  } catch (e) {
    return false;
  }
}

/**
 * 使用 Cookies 登录（注入 cookies 后检测登录状态）
 * @param {string} accountId - 浏览器实例ID
 * @param {string} cookiesStr - Cookies JSON 字符串
 * @returns {Object} 登录结果
 */
async function loginWithCookies(accountId, cookiesStr) {
  const result = { success: false, step: '', error: null, usedCookies: true };

  try {
    result.step = '注入 Cookies';
    const { page } = browser.getInstance(accountId);
    const injected = await browser.injectCookies(page, cookiesStr);

    if (!injected) {
      result.step = 'Cookies 格式无效，将使用账号密码登录';
      result.usedCookies = false;
      return result;
    }

    await browser.randomDelay(2000, 3500);

    result.step = '验证登录状态';
    const loggedIn = await isLoggedIn(accountId);

    if (loggedIn) {
      result.success = true;
      result.step = 'Cookies 登录成功';
      // 处理登录后弹窗
      await handlePostLoginPopups(accountId);
    } else {
      result.step = 'Cookies 已过期，将使用账号密码登录';
      result.usedCookies = false;
    }
  } catch (e) {
    result.error = e.message;
    result.usedCookies = false;
  }

  return result;
}

/**
 * 完整登录流程（支持自动 2FA，支持 Cookies 优先）
 * @param {string} accountId - 浏览器实例ID
 * @param {string} username - IG 用户名
 * @param {string} password - IG 密码
 * @param {string} [twofaSecret] - 2FA Base32 密钥（配置后自动验证）
 * @param {string} [cookies] - IG Cookies（有则优先使用，跳过账号密码登录）
 */
async function login(accountId, username, password, twofaSecret, cookies) {
  const result = { success: false, step: '', error: null, need2FA: false, twofaAuto: false, usedCookies: false };

  try {
    // 优先使用 Cookies 登录
    if (cookies && cookies.trim()) {
      result.step = '尝试 Cookies 登录';
      const cookieResult = await loginWithCookies(accountId, cookies);
      if (cookieResult.success) {
        return { ...result, ...cookieResult };
      }
      // Cookies 登录失败，降级为账号密码登录
      result.step = cookieResult.step || 'Cookies 登录失败，使用账号密码';
    }

    result.step = '打开登录页';
    await openLoginPage(accountId);

    result.step = '输入账号密码';
    await fillAndSubmit(accountId, username, password);

    // 检测是否需要2FA
    await browser.randomDelay(3000, 5000);
    const { page } = browser.getInstance(accountId);
    const has2FA = await page.evaluate((sel) => {
      return document.querySelector(sel) !== null;
    }, SELECTORS.login.twoFactorInput).catch(() => false);

    if (has2FA) {
      if (twofaSecret) {
        // 自动 2FA 验证
        result.step = '自动2FA验证中';
        result.twofaAuto = true;

        // 生成当前 TOTP 验证码
        const code = totp.generateTOTP(twofaSecret);
        if (!code) {
          result.need2FA = true;
          result.step = '2FA密钥无效，需手动验证';
          return result;
        }

        // 等待验证码输入框，填写并提交
        await page.waitForSelector(SELECTORS.login.twoFactorInput, { timeout: 10000 });
        await browser.randomDelay(800, 1500);
        await page.type(SELECTORS.login.twoFactorInput, code, { delay: 100 + Math.random() * 50 });
        await browser.randomDelay(500, 1000);
        await browser.humanClick(accountId, SELECTORS.login.twoFactorConfirm);
        await browser.randomDelay(3000, 5000);

        // 验证是否登录成功（2FA 验证码可能过期，重试一次）
        let loggedIn = await isLoggedIn(accountId);
        if (!loggedIn) {
          // 检查是否还在 2FA 页面（验证码可能已过期）
          const still2FA = await page.evaluate((sel) => {
            return document.querySelector(sel) !== null;
          }, SELECTORS.login.twoFactorInput).catch(() => false);

          if (still2FA) {
            // 清空输入框，重新生成验证码
            await page.evaluate((sel) => {
              const input = document.querySelector(sel);
              if (input) input.value = '';
            }, SELECTORS.login.twoFactorInput);
            await browser.randomDelay(1000, 2000);

            const newCode = totp.generateTOTP(twofaSecret);
            await page.type(SELECTORS.login.twoFactorInput, newCode, { delay: 100 });
            await browser.randomDelay(500, 1000);
            await browser.humanClick(accountId, SELECTORS.login.twoFactorConfirm);
            await browser.randomDelay(3000, 5000);
            loggedIn = await isLoggedIn(accountId);
          }
        }

        if (loggedIn) {
          result.success = true;
          result.step = '2FA自动验证成功，登录完成';
        } else {
          result.need2FA = true;
          result.step = '2FA自动验证失败，需手动验证';
        }
        return result;
      } else {
        // 没有配置 2FA 密钥，需要手动验证
        result.need2FA = true;
        result.step = '需要2FA验证（未配置自动密钥）';
        return result;
      }
    }

    result.step = '处理登录弹窗';
    await handlePostLoginPopups(accountId);

    result.success = await isLoggedIn(accountId);
    result.step = result.success ? '登录成功' : '登录失败';
  } catch (e) {
    result.error = e.message;
  }

  return result;
}

/**
 * 提交2FA验证码
 */
async function submit2FA(accountId, code) {
  const { page } = browser.getInstance(accountId);
  try {
    await page.waitForSelector(SELECTORS.login.twoFactorInput, { timeout: 10000 });
    await page.type(SELECTORS.login.twoFactorInput, code, { delay: 100 });
    await browser.randomDelay(500, 1000);
    await browser.humanClick(accountId, SELECTORS.login.twoFactorConfirm);
    await browser.randomDelay(2000, 4000);
    await handlePostLoginPopups(accountId);
    return await isLoggedIn(accountId);
  } catch (e) {
    return false;
  }
}

module.exports = {
  openLoginPage,
  fillAndSubmit,
  handlePostLoginPopups,
  isLoggedIn,
  login,
  loginWithCookies,
  submit2FA,
};
