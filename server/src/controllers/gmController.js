const { User, Announcement, ChatMessage, BattleLog } = require('../models');

class GMController {
  // 获取所有玩家列表
  async getAllPlayers(req, res) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      
      const query = {};
      if (search) {
        query.$or = [
          { username: new RegExp(search, 'i') },
          { characterName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ];
      }
      
      const players = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
      
      const total = await User.countDocuments(query);
      
      res.json({
        success: true,
        data: {
          players,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 修改玩家属性
  async modifyPlayer(req, res) {
    try {
      const { playerId } = req.params;
      const updates = req.body;
      
      // 不允许修改的字段
      delete updates.password;
      delete updates._id;
      delete updates.username;
      
      const player = await User.findByIdAndUpdate(playerId, updates, { new: true });
      
      if (!player) {
        return res.status(404).json({
          success: false,
          message: '玩家不存在'
        });
      }
      
      res.json({
        success: true,
        message: '修改成功',
        data: player
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 封禁/解封玩家
  async banPlayer(req, res) {
    try {
      const { playerId } = req.params;
      const { banned, reason } = req.body;
      
      const player = await User.findById(playerId);
      if (!player) {
        return res.status(404).json({
          success: false,
          message: '玩家不存在'
        });
      }
      
      player.status = banned ? 'banned' : 'offline';
      await player.save();
      
      res.json({
        success: true,
        message: banned ? '已封禁玩家' : '已解封玩家'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 发放物品
  async giveItem(req, res) {
    try {
      const { playerId } = req.params;
      const { itemId, quantity = 1 } = req.body;
      
      const Inventory = require('../models/Inventory');
      
      const item = new Inventory({
        userId: playerId,
        itemId,
        quantity
      });
      
      await item.save();
      
      res.json({
        success: true,
        message: '物品发放成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 发放金钱
  async giveGold(req, res) {
    try {
      const { playerId } = req.params;
      const { amount } = req.body;
      
      const player = await User.findById(playerId);
      if (!player) {
        return res.status(404).json({
          success: false,
          message: '玩家不存在'
        });
      }
      
      player.gold += amount;
      await player.save();
      
      res.json({
        success: true,
        message: `已发放 ${amount} 金币`,
        data: { gold: player.gold }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 发布公告
  async createAnnouncement(req, res) {
    try {
      const { title, content, type = 'normal', pinned = false, endTime } = req.body;
      
      const announcement = new Announcement({
        title,
        content,
        type,
        pinned,
        endTime,
        author: req.userId,
        authorName: req.user.characterName
      });
      
      await announcement.save();
      
      res.json({
        success: true,
        message: '公告发布成功',
        data: announcement
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取公告列表
  async getAnnouncements(req, res) {
    try {
      const announcements = await Announcement.find({ status: 'published' })
        .sort({ pinned: -1, createdAt: -1 })
        .limit(50);
      
      res.json({
        success: true,
        data: announcements
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 删除公告
  async deleteAnnouncement(req, res) {
    try {
      const { announcementId } = req.params;
      
      await Announcement.findByIdAndDelete(announcementId);
      
      res.json({
        success: true,
        message: '公告已删除'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取统计数据
  async getStatistics(req, res) {
    try {
      const totalPlayers = await User.countDocuments();
      const onlinePlayers = await User.countDocuments({ status: 'online' });
      const newPlayersToday = await User.countDocuments({
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
      });
      
      res.json({
        success: true,
        data: {
          totalPlayers,
          onlinePlayers,
          newPlayersToday
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // 获取战斗日志
  async getBattleLogs(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      
      const logs = await BattleLog.find()
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
      
      const total = await BattleLog.countDocuments();
      
      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new GMController();
