const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { User } = require('../models');

// 登录失败追踪 { ip/username: { count, lockedUntil } }
const loginFailures = new Map();
setInterval(() => {
  for (const [key, v] of loginFailures) {
    if (Date.now() > v.lockedUntil) loginFailures.delete(key);
  }
}, 60000);

// 活跃socket追踪 (userId -> socketId) 用于单设备登录
const activeSockets = new Map();

function registerSocket(userId, socketId) {
  const oldSocketId = activeSockets.get(userId.toString());
  activeSockets.set(userId.toString(), socketId);
  return oldSocketId; // 返回旧连接ID用于踢下线
}
function unregisterSocket(userId, socketId) {
  if (activeSockets.get(userId.toString()) === socketId) {
    activeSockets.delete(userId.toString());
  }
}
function findSocketByUserId(userId) {
  return activeSockets.get(userId?.toString());
}

// 检查登录失败锁定
function isLoginLocked(identifier) {
  const record = loginFailures.get(identifier);
  if (!record) return false;
  if (Date.now() > record.lockedUntil) {
    loginFailures.delete(identifier);
    return false;
  }
  return true;
}
function recordLoginFailure(identifier) {
  if (!loginFailures.has(identifier)) loginFailures.set(identifier, { count: 0, lockedUntil: 0 });
  const r = loginFailures.get(identifier);
  r.count++;
  if (r.count >= 5) r.lockedUntil = Date.now() + 900000; // 5次失败锁15分钟
}
function clearLoginFailures(identifier) {
  loginFailures.delete(identifier);
}

// 密码复杂度校验
function validatePasswordStrength(password) {
  if (!password || password.length < 8) return '密码至少8位';
  if (!/[a-zA-Z]/.test(password)) return '密码需包含字母';
  if (!/[0-9]/.test(password)) return '密码需包含数字';
  return null;
}

// 设备指纹
function getDeviceFingerprint(req) {
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('md5').update(ua).digest('hex').slice(0, 16);
}

// 验证JWT Token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: '请先登录' });

    const decoded = jwt.verify(token, config.jwt.secret);
    // Token绑定设备指纹（可选严格模式）
    if (config.env === 'production' && decoded.fingerprint) {
      const currentFp = getDeviceFingerprint(req);
      if (currentFp !== decoded.fingerprint) {
        return res.status(401).json({ success: false, message: '登录环境异常，请重新登录' });
      }
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: '用户不存在' });
    if (user.status === 'banned') return res.status(403).json({ success: false, message: '账号已被封禁' });

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
};

// GM权限分级
const GM_LEVELS = {
  gm: { canViewPlayers: true, canAnnounce: true, canViewLogs: true, canViewStats: true, canModifyPlayer: false, canModifyConfig: false, canManageGM: false },
  senior_gm: { canViewPlayers: true, canAnnounce: true, canViewLogs: true, canViewStats: true, canModifyPlayer: true, canModifyConfig: false, canManageGM: false },
  admin: { canViewPlayers: true, canAnnounce: true, canViewLogs: true, canViewStats: true, canModifyPlayer: true, canModifyConfig: true, canManageGM: true }
};

const gmMiddleware = (requiredPermission = 'canViewPlayers') => {
  return (req, res, next) => {
    const role = req.user?.role;
    const perms = GM_LEVELS[role];
    if (!perms || !perms[requiredPermission]) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    next();
  };
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: '需要管理员权限' });
  next();
};

// Socket认证（单设备登录：新连接踢旧连接）
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('请先登录'));

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('用户不存在'));
    if (user.status === 'banned') return next(new Error('账号已被封禁'));

    // 单设备登录：踢掉旧连接
    const oldSocketId = registerSocket(user._id, socket.id);
    if (oldSocketId) {
      const io = require('../socket').getIO?.();
      if (io) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.emit('system_message', { content: '⚠️ 你的账号在其他设备登录，当前连接已断开' });
          setTimeout(() => oldSocket.disconnect(true), 500);
        }
      }
    }

    socket.user = user;
    socket.userId = user._id;
    next();
  } catch (error) {
    next(new Error('登录已过期'));
  }
};

module.exports = {
  authMiddleware, gmMiddleware, adminMiddleware, socketAuthMiddleware,
  isLoginLocked, recordLoginFailure, clearLoginFailures,
  validatePasswordStrength, getDeviceFingerprint,
  registerSocket, unregisterSocket, findSocketByUserId,
  GM_LEVELS
};
