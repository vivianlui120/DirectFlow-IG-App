/**
 * Core 任务调度器
 * 负责任务队列管理、分发、执行状态跟踪
 */
const db = require('./db');
const igDriver = require('../ig-driver');

// 任务队列
const taskQueue = [];
let isProcessing = false;

/**
 * 添加任务到队列
 */
function enqueueTask(task) {
  const saved = db.addTask(task);
  taskQueue.push(saved);
  processQueue();
  return saved;
}

/**
 * 处理队列
 */
async function processQueue() {
  if (isProcessing || taskQueue.length === 0) return;
  isProcessing = true;

  while (taskQueue.length > 0) {
    const task = taskQueue.shift();
    db.updateTask(task.id, { status: 'running', startedAt: new Date().toISOString() });

    try {
      const result = await executeTask(task);
      db.updateTask(task.id, { status: 'completed', result, finishedAt: new Date().toISOString() });
    } catch (e) {
      db.updateTask(task.id, { status: 'failed', error: e.message, finishedAt: new Date().toISOString() });
    }
  }

  isProcessing = false;
}

/**
 * 执行单个任务
 */
async function executeTask(task) {
  switch (task.type) {
    case 'warmup':
      return await require('./warmup').manualWarmup(task.accountId);
    case 'browse_feed':
      return await igDriver.browseFeed(task.accountId, task.options || {});
    case 'watch_stories':
      return await igDriver.watchStories(task.accountId, task.options || {});
    case 'like_post':
      return await igDriver.likePost(task.accountId, task.postIndex || 0);
    default:
      throw new Error('未知任务类型: ' + task.type);
  }
}

/**
 * 获取队列状态
 */
function getQueueStatus() {
  return {
    pending: taskQueue.length,
    processing: isProcessing,
    recentTasks: db.getTasks().slice(0, 20),
  };
}

module.exports = {
  enqueueTask,
  processQueue,
  getQueueStatus,
};
