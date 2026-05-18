// 请求频率限制器 — 防脚本/防DDoS第一道防线

// 每个用户的Socket事件频率追踪 { userId: { eventName: [timestamps] } }
const socketRateMap = new Map();
// HTTP API频率追踪 { ip: [timestamps] }
const httpRateMap = new Map();

// 清理过期记录（每5分钟）
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, events] of socketRateMap) {
    for (const [event, times] of Object.entries(events)) {
      events[event] = times.filter(t => t > cutoff);
    }
  }
  for (const [ip, times] of httpRateMap) {
    httpRateMap.set(ip, times.filter(t => t > cutoff));
  }
}, 300000);

// Socket事件频率配置 (事件名 -> {窗口秒数, 最大次数, 最小间隔ms})
const socketRateConfig = {
  move: { window: 1, max: 5, minInterval: 150 },
  battle_action: { window: 1, max: 3, minInterval: 300 },
  battle_start: { window: 1, max: 2, minInterval: 500 },
  chat_world: { window: 10, max: 5, minInterval: 1000 },
  chat_room: { window: 10, max: 10, minInterval: 500 },
  chat_private: { window: 10, max: 10, minInterval: 500 },
  chat_gang: { window: 10, max: 10, minInterval: 500 },
  buy_item: { window: 1, max: 4, minInterval: 200 },
  sell_item: { window: 1, max: 5, minInterval: 200 },
  trade_request: { window: 1, max: 2, minInterval: 500 },
  trade_confirm: { window: 1, max: 3, minInterval: 300 },
  pickup_item: { window: 1, max: 5, minInterval: 150 },
  gather: { window: 1, max: 3, minInterval: 300 },
  forge: { window: 1, max: 3, minInterval: 300 },
  alchemy: { window: 1, max: 3, minInterval: 300 },
  cooking: { window: 1, max: 3, minInterval: 300 },
  auction_create: { window: 1, max: 3, minInterval: 300 },
  auction_buy: { window: 1, max: 5, minInterval: 200 },
  default: { window: 1, max: 10, minInterval: 80 }
};

// HTTP API频率配置
const httpRateConfig = {
  '/api/auth/login': { window: 60, max: 10 },
  '/api/auth/register': { window: 3600, max: 3 },
  default: { window: 60, max: 60 }
};

// Socket频率检查，返回 { allowed: bool, penalty: 'warn'|'mute'|'kick'|null }
function checkSocketRate(userId, eventName) {
  const now = Date.now();
  if (!socketRateMap.has(userId)) socketRateMap.set(userId, {});
  const userRates = socketRateMap.get(userId);
  if (!userRates[eventName]) userRates[eventName] = [];
  const timestamps = userRates[eventName];

  const config = socketRateConfig[eventName] || socketRateConfig.default;

  // 清理窗口外记录
  const windowStart = now - config.window * 1000;
  while (timestamps.length > 0 && timestamps[0] < windowStart) timestamps.shift();

  // 检查窗口内次数
  if (timestamps.length >= config.max) {
    return { allowed: false, penalty: timestamps.length >= config.max * 3 ? 'kick' : timestamps.length >= config.max * 2 ? 'mute' : 'warn' };
  }

  // 检查最小间隔
  if (timestamps.length > 0 && (now - timestamps[timestamps.length - 1]) < config.minInterval) {
    return { allowed: false, penalty: 'warn' };
  }

  timestamps.push(now);
  return { allowed: true, penalty: null };
}

// HTTP频率检查
function checkHttpRate(ip, path) {
  const now = Date.now();
  if (!httpRateMap.has(ip)) httpRateMap.set(ip, []);
  const timestamps = httpRateMap.get(ip);
  const config = httpRateConfig[path] || httpRateConfig.default;
  const windowStart = now - config.window * 1000;
  while (timestamps.length > 0 && timestamps[0] < windowStart) timestamps.shift();
  if (timestamps.length >= config.max) return false;
  timestamps.push(now);
  return true;
}

// Express中间件
function httpRateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkHttpRate(ip, req.path)) {
    return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
  }
  next();
}

module.exports = { checkSocketRate, checkHttpRate, httpRateLimiter, socketRateConfig };
