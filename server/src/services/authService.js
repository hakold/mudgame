const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

class AuthService {
  // 用户注册
  async register(userData) {
    const { username, password, email, characterName, gender } = userData;
    
    // 检查用户名是否存在
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      throw new Error('用户名已存在');
    }
    
    // 检查邮箱是否存在
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new Error('邮箱已被注册');
    }
    
    // 检查角色名是否存在
    const existingCharacter = await User.findOne({ characterName });
    if (existingCharacter) {
      throw new Error('角色名已被使用');
    }
    
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
  
  // 用户登录
  async login(username, password) {
    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error('用户名或密码错误');
    }
    
    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('用户名或密码错误');
    }
    
    // 更新登录时间
    user.lastLogin = new Date();
    user.status = 'online';
    await user.save();
    
    // 生成token
    const token = this.generateToken(user);
    
    return {
      user: this.sanitizeUser(user),
      token
    };
  }
  
  // 生成JWT Token
  generateToken(user) {
    return jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        role: user.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
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
    if (!user) {
      throw new Error('用户不存在');
    }
    
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw new Error('原密码错误');
    }
    
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
