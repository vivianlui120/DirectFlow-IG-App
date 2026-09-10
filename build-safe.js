/**
 * 安全构建脚本：备份 → 混淆 → 打包 → 恢复源文件
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FILES_TO_BACKUP = [
  'main.js',
  'src/core/license-manager.js',
  'src/core/auth-service.js',
  'src/core/db.js',
];

const BACKUP_DIR = path.join(__dirname, '.backup-obfuscate');

function backupFiles() {
  console.log('[1/4] 备份源文件...');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  FILES_TO_BACKUP.forEach(file => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      const dest = path.join(BACKUP_DIR, path.basename(file));
      fs.copyFileSync(src, dest);
      console.log(`  已备份: ${file}`);
    }
  });
}

function obfuscateFiles() {
  console.log('[2/4] 混淆代码...');
  execSync('node obfuscate.js', { stdio: 'inherit', cwd: __dirname });
}

function buildApp() {
  console.log('[3/4] 打包软件...');
  execSync('npx electron-builder --win', { stdio: 'inherit', cwd: __dirname });
}

function restoreFiles() {
  console.log('[4/4] 恢复源文件...');
  FILES_TO_BACKUP.forEach(file => {
    const backup = path.join(BACKUP_DIR, path.basename(file));
    const dest = path.join(__dirname, file);
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, dest);
      console.log(`  已恢复: ${file}`);
    }
  });
  // 清理备份目录
  if (fs.existsSync(BACKUP_DIR)) {
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
}

// 主流程
async function main() {
  try {
    backupFiles();
    obfuscateFiles();
    buildApp();
    console.log('\n========================================');
    console.log('  构建成功！安装包在 dist 目录');
    console.log('========================================');
  } catch (err) {
    console.error('\n构建失败:', err.message);
  } finally {
    restoreFiles();
  }
}

main();
