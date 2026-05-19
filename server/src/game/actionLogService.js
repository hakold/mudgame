const ActionLog = require('../models/ActionLog');

// 异步记录日志，不影响游戏性能
function log(userId, characterName, category, action, details = {}, roomId = null, targetId = null) {
  ActionLog.create({
    userId,
    characterName,
    category,
    action,
    details,
    roomId,
    targetId
  }).catch(err => {
    console.error('[ActionLog] Failed to write log:', err.message);
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 查询日志
async function queryLogs(filters = {}) {
  const { userId, characterName, category, action, roomId, startTime, endTime, keyword, page = 1, limit = 50 } = filters;
  const query = {};

  if (userId) query.userId = userId;
  if (characterName) query.characterName = { $regex: escapeRegex(characterName), $options: 'i' };
  if (category) query.category = category;
  if (action) query.action = action;
  if (roomId) query.roomId = roomId;
  if (startTime || endTime) {
    query.createdAt = {};
    if (startTime) query.createdAt.$gte = new Date(startTime);
    if (endTime) query.createdAt.$lte = new Date(endTime);
  }
  if (keyword) {
    const escaped = escapeRegex(keyword);
    query.$or = [
      { 'details': { $regex: escaped, $options: 'i' } },
      { 'characterName': { $regex: escaped, $options: 'i' } }
    ];
  }

  const total = await ActionLog.countDocuments(query);
  const logs = await ActionLog.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  return { logs, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) };
}

// 日志统计
async function getLogStats(days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const stats = await ActionLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { category: '$category', action: '$action' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  return stats;
}

module.exports = { log, queryLogs, getLogStats };
