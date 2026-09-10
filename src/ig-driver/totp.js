/**
 * TOTP (Time-based One-Time Password) 验证码生成
 * 基于 RFC 6238 标准，兼容 Google Authenticator、Authy 等
 *
 * 用于 IG 登录时自动填写 2FA 验证码
 */
const crypto = require('crypto');

/**
 * Base32 解码
 * @param {string} base32 - Base32 编码的密钥（通常从 IG 2FA 设置中获取）
 * @returns {Buffer} 解码后的二进制密钥
 */
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');

  const bits = [];
  for (const char of cleaned) {
    const val = alphabet.indexOf(char);
    bits.push(val.toString(2).padStart(5, '0'));
  }

  const bitString = bits.join('');
  const bytes = [];
  for (let i = 0; i + 8 <= bitString.length; i += 8) {
    bytes.push(parseInt(bitString.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * 生成 TOTP 验证码
 * @param {string} secret - Base32 编码的密钥
 * @param {number} [digits=6] - 验证码位数
 * @param {number} [period=30] - 时间步长（秒）
 * @param {number} [timestamp] - 指定时间戳（默认当前时间）
 * @returns {string} 6 位数字验证码
 */
function generateTOTP(secret, digits = 6, period = 30, timestamp = Date.now()) {
  if (!secret) return null;

  try {
    const key = base32Decode(secret);
    const counter = Math.floor(timestamp / 1000 / period);

    // 将 counter 转为 8 字节大端序
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter), 0);

    // HMAC-SHA1
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuf);
    const hash = hmac.digest();

    // 动态截断 (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
  } catch (e) {
    return null;
  }
}

/**
 * 验证 TOTP 验证码（允许 ±1 个时间步的误差）
 * @param {string} secret - Base32 密钥
 * @param {string} token - 用户输入的验证码
 * @param {number} [window=1] - 允许的时间步偏差
 * @returns {boolean}
 */
function verifyTOTP(secret, token, window = 1) {
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const expected = generateTOTP(secret, 6, 30, now + i * 30 * 1000);
    if (expected === token) return true;
  }
  return false;
}

/**
 * 获取验证码剩余有效秒数
 * @returns {number} 0-29 秒
 */
function getRemainingSeconds() {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

module.exports = {
  generateTOTP,
  verifyTOTP,
  base32Decode,
  getRemainingSeconds,
};
