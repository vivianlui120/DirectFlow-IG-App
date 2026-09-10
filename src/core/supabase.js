/**
 * Supabase 客户端配置
 * 云端数据库 + 认证服务
 */
// Electron 主进程 Node.js 20 没有原生 WebSocket，用 ws 库提供
if (!global.WebSocket) {
  global.WebSocket = require('ws');
}
const { createClient } = require('@supabase/supabase-js');

// Supabase 项目配置
const SUPABASE_URL = 'https://hknxiaeljbbevddvalhv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Z0LljQrqdOA0nSL8za0Img_lAmiffiN';

// 创建客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    enabled: false,
  },
});

module.exports = { supabase, SUPABASE_URL };
