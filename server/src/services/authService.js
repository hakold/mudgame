const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { isLoginLocked, recordLoginFailure, clearLoginFailures, validatePasswordStrength, getDeviceFingerprint } = require('../middleware/auth');

class AuthService {
  // 用户注册
  async register(userData) {
    const { username, password, email, characterName, gender } = userData;

    // 密码复杂度
    const pwError = validatePasswordStrength(password);
    if (pwError) throw new Error(pwError);

    // 检查用户名是否存在
    const existingUsername = await User.findOne({ username });
    if (existingUsername) throw new Error('用户名已存在');

    // 检查邮箱是否存在
    const existingEmail = await User.findOne({ email });
    if (existingEmail) throw new Error('邮箱已被注册');

    // 检查角色名是否存在
    const existingCharacter = await User.findOne({ characterName });
    if (existingCharacter) throw new Error('角色名已被使用');
    
    // 创建用户
    const user = new User({
      username,
      password,
      email,
      characterName,
      gender,
      hp: {
        current: 100,
        max: 100
      },
      mp: {
        current: 50,
        max: 50
      }
    });
    
    await user.save();
    
    // 生成token
    const token = this.generateToken(user);
    
    return {
      user: this.sanitizeUser(user),
      token
    };
  }
  
  // 用户登录（req用于设备指纹）
  async login(username, password, req = null) {
    // 检查登录锁定
    if (isLoginLocked(username)) {
      throw new Error('登录失败次数过多，请15分钟后再试');
    }
    const ip = req?.ip || req?.socket?.remoteAddress;
    if (ip && isLoginLocked(ip)) {
      throw new Error('登录失败次数过多，请15分钟后再试');
    }

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      recordLoginFailure(username);
      if (ip) recordLoginFailure(ip);
      throw new Error('用户名或密码错误');
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      recordLoginFailure(username);
      if (ip) recordLoginFailure(ip);
      throw new Error('用户名或密码错误');
    }

    // 清除失败记录
    clearLoginFailures(username);
    if (ip) clearLoginFailures(ip);

    // 更新登录时间
    user.lastLogin = new Date();
    user.status = 'online';
    await user.save();

    // 生成token（含设备指纹）
    const fingerprint = req ? getDeviceFingerprint(req) : null;
    const token = this.generateToken(user, fingerprint);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  // 生成JWT Token
  generateToken(user, fingerprint = null) {
    const payload = { userId: user._id, username: user.username, role: user.role };
    if (fingerprint) payload.fingerprint = fingerprint;
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  }
  
  // 验证Token
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      return null;
    }
  }
  
  // 清理用户敏感信息
  sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    return obj;
  }
  
  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) throw new Error('原密码错误');

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) throw new Error(pwError);

    user.password = newPassword;
    await user.save();
    return true;
  }
  
  // 重置密码（通过邮箱）
  async resetPassword(email, newPassword) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('邮箱未注册');
    }
    
    user.password = newPassword;
    await user.save();
    
    return true;
  }
  
  // 获取用户信息
  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    return this.sanitizeUser(user);
  }
  
  // 更新用户状态
  async updateStatus(userId, status) {
    await User.findByIdAndUpdate(userId, { status });
  }
}

module.exports = new AuthService();
