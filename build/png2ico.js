// 简单的 PNG 转 ICO 工具（现代 ICO 支持嵌入 PNG 数据）
const fs = require('fs');
const path = require('path');

const pngFile = path.join(__dirname, 'icon.png');
const icoFile = path.join(__dirname, 'icon.ico');

const pngData = fs.readFileSync(pngFile);

// 获取 PNG 尺寸（从 IHDR chunk 读取）
const width = pngData.readUInt32BE(16);
const height = pngData.readUInt32BE(20);

// ICO 头部：6字节
// reserved(2) = 0, type(2) = 1 (icon), count(2) = 1
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count: 1

// 目录条目：16字节
// width(1), height(1), colorCount(1), reserved(1), planes(2), bitCount(2), bytesInRes(4), imageOffset(4)
const entry = Buffer.alloc(16);
entry.writeUInt8(width >= 256 ? 0 : width, 0);  // 0 表示 256
entry.writeUInt8(height >= 256 ? 0 : height, 1); // 0 表示 256
entry.writeUInt8(0, 2);  // colorCount
entry.writeUInt8(0, 3);  // reserved
entry.writeUInt16LE(1, 4);  // planes
entry.writeUInt16LE(32, 6); // bitCount
entry.writeUInt32LE(pngData.length, 8); // bytesInRes
entry.writeUInt32LE(22, 12); // imageOffset (6 header + 16 entry)

const icoData = Buffer.concat([header, entry, pngData]);
fs.writeFileSync(icoFile, icoData);

console.log(`ICO generated: ${icoFile} (${icoData.length} bytes, ${width}x${height})`);
