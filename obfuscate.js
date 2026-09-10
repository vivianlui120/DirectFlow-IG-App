/**
 * 代码混淆脚本
 * 打包前自动混淆主进程关键代码，增加破解难度
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// 需要混淆的文件列表（主进程关键代码）
const FILES_TO_OBFUSCATE = [
  'main.js',
  'src/core/license-manager.js',
  'src/core/auth-service.js',
  'src/core/db.js',
];

// 混淆配置
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 4000,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

function obfuscateFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`[跳过] 文件不存在: ${filePath}`);
    return;
  }

  console.log(`[混淆中] ${filePath}...`);
  const originalCode = fs.readFileSync(fullPath, 'utf-8');

  try {
    const obfuscated = JavaScriptObfuscator.obfuscate(originalCode, OBFUSCATOR_OPTIONS);
    fs.writeFileSync(fullPath, obfuscated.getObfuscatedCode(), 'utf-8');
    console.log(`[完成] ${filePath} (${(originalCode.length / 1024).toFixed(1)}KB -> ${(obfuscated.getObfuscatedCode().length / 1024).toFixed(1)}KB)`);
  } catch (err) {
    console.error(`[失败] ${filePath}: ${err.message}`);
  }
}

console.log('========================================');
console.log('  智连 IG - 代码混淆开始');
console.log('========================================');

FILES_TO_OBFUSCATE.forEach(obfuscateFile);

console.log('========================================');
console.log('  代码混淆完成');
console.log('========================================');
