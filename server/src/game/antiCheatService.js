// 反脚本/反自动化检测服务
// 通过行为模式分析识别脚本操作

const ActionLog = require('../models/ActionLog');
const User = require('../models/User');

// 玩家行为追踪 { userId: { lastActionTime, actionIntervals: [], warnings: 0, suspiciousLevel: 0, mutedUntil: null } }
const playerBehavior = new Map();

// 每小时清理离线玩家
setInterval(() => {
  for (const [userId, data] of playerBehavior) {
    if (Date.now() - data.lastActionTime > 3600000) playerBehavior.delete(userId);
  }
}, 600000);

// 可疑等级阈值
const SUS_LEVELS = {
  NORMAL: 0,
  WATCH: 1,    // 记录观察
  MILD: 2,     // 限制交易/拍卖
  HIGH: 3,     // 禁言
  SEVERE: 4,   // 自动踢下线
  BAN: 5       // 临时封禁
};

function getOrCreate(userId) {
  if (!playerBehavior.has(userId)) {
    playerBehavior.set(userId, {
      lastActionTime: Date.now(),
      actionIntervals: [],
      actionCount: 0,
      warnings: 0,
      suspiciousLevel: 0,
      mutedUntil: null,
      sameIntervalStreak: 0,
      last10Actions: []
    });
  }
  return playerBehavior.get(userId);
}

// 记录玩家操作并检测异常
function recordAction(userId, action, details = {}) {
  const b = getOrCreate(userId);
  const now = Date.now();
  const interval = now - b.lastActionTime;

  b.actionCount++;
  b.lastActionTime = now;

  // 追踪最近10个动作类型
  b.last10Actions.push({ action, time: now, interval });
  if (b.last10Actions.length > 10) b.last10Actions.shift();

  // 检测1: 动作间隔过于规律（脚本特征：精确间隔）
  if (b.last10Actions.length >= 5) {
    const intervals = b.last10Actions.slice(-5).map(a => a.interval);
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // 标准差极小 + 间隔合理 → 高度疑似脚本
    if (mean > 50 && mean < 5000 && stdDev < mean * 0.05 && intervals.length >= 5) {
      b.sameIntervalStreak++;
      if (b.sameIntervalStreak >= 3) {
        escalateSuspicion(userId, '动作间隔过于规律(疑似脚本)', { mean: Math.round(mean), stdDev: Math.round(stdDev), action });
      }
    } else {
      b.sameIntervalStreak = Math.max(0, b.sameIntervalStreak - 1);
    }
  }

  // 检测2: 单一动作大量重复
  if (b.last10Actions.length >= 10) {
    const sameAction = b.last10Actions.filter(a => a.action === action).length;
    if (sameAction >= 9) {
      escalateSuspicion(userId, `连续重复动作: ${action}`, { count: sameAction });
    }
  }

  // 检测3: 不可能的人类反应速度 (< 50ms连续操作)
  if (interval < 50 && b.actionCount > 10) {
    b.warnings++;
    if (b.warnings >= 10) {
      escalateSuspicion(userId, '操作速度异常(疑似加速器)', { interval });
    }
  }

  // 检测4: 24小时内操作量异常大
  if (b.actionCount > 50000) {
    escalateSuspicion(userId, '24h操作量异常', { count: b.actionCount });
  }

  return { level: b.suspiciousLevel };
}

// 升级可疑等级
function escalateSuspicion(userId, reason, details = {}) {
  const b = getOrCreate(userId);
  if (b.suspiciousLevel < 5) b.suspiciousLevel++;
  ActionLog.create({
    userId, characterName: '系统', category: 'system', action: 'anti_cheat',
    details: { reason, level: b.suspiciousLevel, ...details }
  }).catch(() => {});

  // 根据等级自动处置
  if (b.suspiciousLevel >= 4) {
    // 自动临时封禁1小时
    User.findByIdAndUpdate(userId, { status: 'banned' }).catch(() => {});
    setTimeout(() => {
      User.findByIdAndUpdate(userId, { status: 'offline' }).catch(() => {});
      b.suspiciousLevel = Math.max(3, b.suspiciousLevel - 2);
    }, 3600000);
  } else if (b.suspiciousLevel >= 3) {
    b.mutedUntil = Date.now() + 1800000; // 禁言30分钟
  }
}

// 检查玩家是否被禁言
function isMuted(userId) {
  const b = playerBehavior.get(userId);
  if (!b || !b.mutedUntil) return false;
  if (Date.now() > b.mutedUntil) { b.mutedUntil = null; return false; }
  return true;
}

// 获取可疑等级
function getSuspicionLevel(userId) {
  return playerBehavior.get(userId)?.suspiciousLevel || 0;
}

// GM查询可疑玩家列表
async function getSuspiciousPlayers(minLevel = 2) {
  const result = [];
  for (const [userId, data] of playerBehavior) {
    if (data.suspiciousLevel >= minLevel) {
      const user = await User.findById(userId).select('characterName level faction').lean();
      if (user) {
        result.push({ userId, characterName: user.characterName, level: user.level, suspicionLevel: data.suspiciousLevel, warnings: data.warnings, muted: !!data.mutedUntil });
      }
    }
  }
  return result.sort((a, b) => b.suspicionLevel - a.suspicionLevel);
}

// GM重置玩家可疑状态
function resetSuspicion(userId) {
  playerBehavior.delete(userId);
  return true;
}

module.exports = { recordAction, isMuted, getSuspicionLevel, getSuspiciousPlayers, resetSuspicion, SUS_LEVELS };
