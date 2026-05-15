const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

// 验证JWT Token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '登录已过期，请重新登录'
    });
  }
};

// 验证GM权限
const gmMiddleware = async (req, res, next) => {
  if (req.user.role !== 'gm' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '权限不足'
    });
  }
  next();
};

// 验证Admin权限
const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }
  next();
};

// Socket认证
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('请先登录'));
    }
    
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return next(new Error('用户不存在'));
    }
    
    socket.user = user;
    socket.userId = user._id;
    next();
  } catch (error) {
    next(new Error('登录已过期'));
  }
};

module.exports = {
  authMiddleware,
  gmMiddleware,
  adminMiddleware,
  socketAuthMiddleware
};
