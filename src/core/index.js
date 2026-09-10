/**
 * Core 业务逻辑层入口
 * 主业务逻辑（数据库、授权、UI、任务分发）集中在此层
 * 与 ig-driver 自动化驱动层完全解耦
 */
const db = require('./db');
const warmup = require('./warmup');
const warmupScheduler = require('./warmup-scheduler');
const taskScheduler = require('./task-scheduler');
const dmDispatcher = require('./dm-dispatcher');
const scraperService = require('./scraper-service');
const autoReplyScheduler = require('./auto-reply-scheduler');

module.exports = {
  // 数据库
  db,
  // 智能养号（旧版兼容）
  warmup,
  // 养号排程器（新版）
  warmupScheduler,
  // 任务调度
  taskScheduler,
  // 群发分发引擎
  dmDispatcher,
  // 名单采集服务
  scraperService,
  // 自动回复调度器
  autoReplyScheduler,
};
