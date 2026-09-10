/**
 * 硬件指纹模块
 * 结合 CPU / 主板 / 内存 / MAC 地址生成 16 位机器码
 * 同一台机器卸载重装后机器码不变
 */
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

let cachedMachineId = null;

/**
 * 获取 Windows 主板 UUID（通过 wmic 或 PowerShell）
 */
function getWindowsUUID() {
  try {
    // 优先用 wmic
    const output = execSync('wmic csproduct get UUID', { encoding: 'utf8', timeout: 5000 });
    const lines = output.trim().split('\n').filter(l => l.trim());
    if (lines.length > 1) return lines[1].trim();
  } catch (e) {}
  try {
    // 降级用 PowerShell
    const output = execSync('powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8', timeout: 5000 });
    return output.trim();
  } catch (e) {}
  return '';
}

/**
 * 获取 Linux/Mac 硬件信息
 */
function getUnixUUID() {
  try {
    if (process.platform === 'darwin') {
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8', timeout: 5000 });
      const match = output.match(/"([A-F0-9-]+)"/);
      if (match) return match[1];
    } else {
      const output = execSync('cat /etc/machine-id 2>/dev/null || dmidecode -s system-uuid 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
      return output.trim();
    }
  } catch (e) {}
  return '';
}

/**
 * 获取第一个非内部网络接口的 MAC 地址
 */
function getMacAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return '';
}

/**
 * 生成机器码
 * 组合：CPU型号 + 总内存 + 主板UUID + MAC地址 + 平台
 * 哈希后取前16位，大写，每4位加一个横杠（如 XXXX-XXXX-XXXX-XXXX）
 */
function generateMachineId() {
  if (cachedMachineId) return cachedMachineId;

  const cpuModel = (os.cpus()[0] && os.cpus()[0].model) || 'unknown';
  const totalMem = os.totalmem();
  const platform = process.platform;
  const mac = getMacAddress();
  const uuid = process.platform === 'win32' ? getWindowsUUID() : getUnixUUID();

  // 组合原始信息
  const raw = [cpuModel, totalMem, platform, mac, uuid].join('|');

  // SHA256 哈希后取前16位
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  const hex16 = hash.substring(0, 16);

  // 格式化为 XXXX-XXXX-XXXX-XXXX
  cachedMachineId = `${hex16.substring(0, 4)}-${hex16.substring(4, 8)}-${hex16.substring(8, 12)}-${hex16.substring(12, 16)}`;

  return cachedMachineId;
}

module.exports = { generateMachineId };
