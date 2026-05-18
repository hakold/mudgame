const authService = require('../services/authService');

class AuthController {
  // 注册
  async register(req, res) {
    try {
      const { username, password, email, characterName, gender } = req.body;
      
      // 验证必填字段
      if (!username || !password || !email || !characterName || !gender) {
        return res.status(400).json({
          success: false,
          message: '请填写所有必填信息'
        });
      }
      
      const result = await authService.register({
        username,
        password,
        email,
        characterName,
        gender
      });
      
      res.json({
        success: true,
        message: '注册成功',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 登录
  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: '请输入用户名和密码'
        });
      }
      
      const result = await authService.login(username, password, req);
      
      res.json({
        success: true,
        message: '登录成功',
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取当前用户信息
  async getCurrentUser(req, res) {
    try {
      const user = authService.sanitizeUser(req.user);
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 修改密码
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      
      await authService.changePassword(req.userId, oldPassword, newPassword);
      
      res.json({
        success: true,
        message: '密码修改成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 重置密码
  async resetPassword(req, res) {
    try {
      const { email, newPassword } = req.body;
      
      await authService.resetPassword(email, newPassword);
      
      res.json({
        success: true,
        message: '密码重置成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();
