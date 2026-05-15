const { User, CharacterSkill, Inventory, Quest } = require('../models');

class PlayerController {
  // 获取玩家信息
  async getPlayerInfo(req, res) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '玩家不存在'
        });
      }
      
      // 获取已学习技能
      const skills = await CharacterSkill.find({ userId: req.userId, learned: true });
      
      // 获取装备中的物品
      const equipment = await Inventory.find({ 
        userId: req.userId, 
        isEquipped: true 
      });
      
      res.json({
        success: true,
        data: {
          player: authService.sanitizeUser(user),
          skills,
          equipment
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 更新属性点
  async updateAttributes(req, res) {
    try {
      const { strength, dexterity, constitution, intelligence, charisma } = req.body;
      const user = await User.findById(req.userId);
      
      // 计算总分配点数
      const totalPoints = (strength || 0) + (dexterity || 0) + (constitution || 0) + 
                          (intelligence || 0) + (charisma || 0);
      
      if (totalPoints > user.freePoints) {
        return res.status(400).json({
          success: false,
          message: '可分配点数不足'
        });
      }
      
      // 更新属性
      if (strength) user.attributes.strength += strength;
      if (dexterity) user.attributes.dexterity += dexterity;
      if (constitution) user.attributes.constitution += constitution;
      if (intelligence) user.attributes.intelligence += intelligence;
      if (charisma) user.attributes.charisma += charisma;
      
      user.freePoints -= totalPoints;
      
      // 重新计算HP/MP上限
      user.hp.max = user.calculateMaxHP();
      user.mp.max = user.calculateMaxMP();
      
      await user.save();
      
      res.json({
        success: true,
        message: '属性更新成功',
        data: authService.sanitizeUser(user)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取背包
  async getInventory(req, res) {
    try {
      const items = await Inventory.find({ userId: req.userId })
        .sort({ obtainedAt: -1 });
      
      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取技能列表
  async getSkills(req, res) {
    try {
      const skills = await CharacterSkill.find({ userId: req.userId });
      
      res.json({
        success: true,
        data: skills
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取任务列表
  async getQuests(req, res) {
    try {
      const quests = await Quest.find({ userId: req.userId });
      
      res.json({
        success: true,
        data: quests
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 移动到新位置
  async move(req, res) {
    try {
      const { mapId, roomId } = req.body;
      
      const user = await User.findById(req.userId);
      user.location = { mapId, roomId };
      await user.save();
      
      res.json({
        success: true,
        message: '移动成功',
        data: user.location
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取在线玩家列表
  async getOnlinePlayers(req, res) {
    try {
      const players = await User.find({ status: 'online' })
        .select('characterName level location status faction')
        .limit(100);
      
      res.json({
        success: true,
        data: players
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 查看其他玩家信息
  async viewPlayer(req, res) {
    try {
      const { playerId } = req.params;
      
      const player = await User.findById(playerId)
        .select('characterName gender level faction attributes hp mp status');
      
      if (!player) {
        return res.status(404).json({
          success: false,
          message: '玩家不存在'
        });
      }
      
      res.json({
        success: true,
        data: player
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

const authService = require('../services/authService');
module.exports = new PlayerController();
