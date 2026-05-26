const fs = require('fs');
const path = require('path');
const { User, Announcement, ChatMessage, BattleLog, ActionLog, Inventory, CharacterSkill, Quest } = require('../models');
const actionLogService = require('../game/actionLogService');
const antiCheatService = require('../game/antiCheatService');
const { getItem } = require('../game');

// 读写 JSON 配置的辅助函数
function readConfig(filename) {
  const filePath = path.join(__dirname, '../../../config/json', `${filename}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function writeConfig(filename, data) {
  const filePath = path.join(__dirname, '../../../config/json', `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

class GMController {
  // ==================== 玩家管理 ====================

  async getAllPlayers(req, res) {
    try {
      const { page = 1, limit = 20, search, faction, status, minLevel, maxLevel, sort = '-createdAt' } = req.query;
      const query = {};
      if (search) query.$or = [{ username: new RegExp(search, 'i') }, { characterName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
      if (faction) query.faction = faction;
      if (status) query.status = status;
      if (minLevel || maxLevel) { query.level = {}; if (minLevel) query.level.$gte = parseInt(minLevel); if (maxLevel) query.level.$lte = parseInt(maxLevel); }
      const players = await User.find(query).select('-password').sort(sort).skip((page - 1) * limit).limit(parseInt(limit));
      const total = await User.countDocuments(query);
      res.json({ success: true, data: { players, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // 获取玩家完整详情
  async getPlayerFullInfo(req, res) {
    try {
      const player = await User.findById(req.params.playerId).select('-password');
      if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });
      const equipment = await Inventory.find({ userId: player._id, isEquipped: true });
      const skills = await CharacterSkill.find({ userId: player._id });
      const quests = await Quest.find({ userId: player._id });
      const inventory = await Inventory.find({ userId: player._id });
      res.json({ success: true, data: { player, equipment, skills, quests, inventory } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getPlayerEquipment(req, res) {
    try {
      const equipment = await Inventory.find({ userId: req.params.playerId, isEquipped: true });
      res.json({ success: true, data: equipment });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getPlayerSkills(req, res) {
    try {
      const skills = await CharacterSkill.find({ userId: req.params.playerId });
      res.json({ success: true, data: skills });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getPlayerInventory(req, res) {
    try {
      const inventory = await Inventory.find({ userId: req.params.playerId });
      res.json({ success: true, data: inventory });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async modifyPlayer(req, res) {
    try {
      const updates = req.body;
      delete updates.password; delete updates._id; delete updates.username;
      const player = await User.findByIdAndUpdate(req.params.playerId, updates, { new: true });
      if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });
      res.json({ success: true, message: '修改成功', data: player });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // 精细属性调整
  async modifyPlayerAttributes(req, res) {
    try {
      const { playerId } = req.params;
      const { attributes, hp, mp, gold, exp, level, faction, factionRank, factionReputation, freePoints, teleportTo, giveItemId, giveItemQty, removeInvId } = req.body;
      const player = await User.findById(playerId);
      if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });
      const changes = [];

      if (attributes) {
        for (const [key, val] of Object.entries(attributes)) {
          if (['strength','dexterity','constitution','intelligence','charisma'].includes(key)) {
            player.attributes[key] = Math.max(1, (player.attributes[key] || 10) + val);
            changes.push(`${key}: ${val>0?'+'+val:val}`);
          }
        }
      }
      if (hp) { player.hp.current = Math.min(player.hp.max, Math.max(1, hp)); changes.push(`HP=${hp}`); }
      if (mp) { player.mp.current = Math.min(player.mp.max, Math.max(0, mp)); changes.push(`MP=${mp}`); }
      if (gold !== undefined) { player.gold = Math.max(0, player.gold + gold); changes.push(`金币 ${gold>0?'+'+gold:gold}`); }
      if (exp !== undefined) { player.exp = Math.max(0, player.exp + exp); changes.push(`经验 ${exp>0?'+'+exp:exp}`); }
      if (level) { player.level = Math.min(100, Math.max(1, level)); player.hp.max = player.calculateMaxHP(); player.mp.max = player.calculateMaxMP(); changes.push(`等级=${level}`); }
      if (faction) { player.faction = faction; changes.push(`门派=${faction}`); }
      if (factionRank) { player.factionRank = factionRank; changes.push(`门派等级=${factionRank}`); }
      if (factionReputation !== undefined) { player.factionReputation = Math.max(0, player.factionReputation + factionReputation); changes.push(`声望 ${factionReputation>0?'+'+factionReputation:factionReputation}`); }
      if (freePoints !== undefined) { player.freePoints = Math.max(0, player.freePoints + freePoints); changes.push(`自由点 ${freePoints>0?'+'+freePoints:freePoints}`); }
      if (teleportTo) { player.location.roomId = teleportTo; changes.push(`传送到 ${teleportTo}`); }
      if (giveItemId) {
        const qty = giveItemQty || 1;
        let inv = await Inventory.findOne({ userId: playerId, itemId: giveItemId });
        if (inv) { inv.quantity += qty; await inv.save(); } else { await Inventory.create({ userId: playerId, itemId: giveItemId, quantity: qty }); }
        const itemCfg = getItem(giveItemId);
        changes.push(`发放 ${itemCfg?.name || giveItemId}×${qty}`);
      }
      if (removeInvId) {
        const invItem = await Inventory.findById(removeInvId);
        if (invItem && invItem.userId.toString() === playerId) {
          changes.push(`扣除 ${invItem.itemId}×${invItem.quantity}`);
          await Inventory.deleteOne({ _id: removeInvId });
        }
      }

      await player.save();
      actionLogService.log(req.userId || playerId, req.user?.characterName || 'GM', 'gm_action', 'modify_player', { targetId: playerId, targetName: player.characterName, changes });
      res.json({ success: true, message: `修改成功: ${changes.join(', ')}`, changes, player: { characterName: player.characterName, level: player.level, gold: player.gold, exp: player.exp, faction: player.faction } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async resetPlayer(req, res) {
    try {
      const player = await User.findById(req.params.playerId);
      if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });
      player.status = 'online';
      player.location.roomId = 'village_center';
      player.hp.current = player.hp.max;
      player.mp.current = player.mp.max;
      await player.save();
      actionLogService.log(req.userId, req.user?.characterName || 'GM', 'gm_action', 'reset_player', { targetId: player._id, targetName: player.characterName });
      res.json({ success: true, message: '玩家已重置' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async banPlayer(req, res) {
    try {
      const { playerId } = req.params;
      const { banned, reason } = req.body;
      const player = await User.findById(playerId);
      if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });
      player.status = banned ? 'banned' : 'offline';
      await player.save();
      actionLogService.log(req.userId, req.user?.characterName || 'GM', 'gm_action', banned ? 'ban' : 'unban', { targetId: playerId, targetName: player.characterName, reason });
      res.json({ success: true, message: banned ? '已封禁玩家' : '已解封玩家' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async giveItem(req, res) {
    try {
      const { playerId } = req.params;
      const { itemId, quantity = 1 } = req.body;
      await Inventory.create({ userId: playerId, itemId, quantity });
      actionLogService.log(req.userId, req.user?.characterName || 'GM', 'gm_action', 'give_item', { targetId: playerId, itemId, quantity });
      res.json({ success: true, message: '物品发放成功' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async giveGold(req, res) {
    try {
      const { playerId } = req.params;
      const { amount } = req.body;
      const player = await User.findById(playerId);
      if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });
      player.gold += amount;
      await player.save();
      actionLogService.log(req.userId, req.user?.characterName || 'GM', 'gm_action', 'give_gold', { targetId: playerId, amount });
      res.json({ success: true, message: `已发放 ${amount} 金币`, data: { gold: player.gold } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ==================== 公告管理 ====================

  async createAnnouncement(req, res) {
    try {
      const { title, content, type = 'normal', pinned = false, endTime } = req.body;
      const ann = new Announcement({ title, content, type, pinned, endTime, author: req.userId, authorName: req.user.characterName });
      await ann.save();
      res.json({ success: true, message: '公告发布成功', data: ann });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getAnnouncements(req, res) {
    try {
      const announcements = await Announcement.find({ status: 'published' }).sort({ pinned: -1, createdAt: -1 }).limit(50);
      res.json({ success: true, data: announcements });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async deleteAnnouncement(req, res) {
    try {
      await Announcement.findByIdAndDelete(req.params.announcementId);
      res.json({ success: true, message: '公告已删除' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ==================== 统计 ====================

  async getStatistics(req, res) {
    try {
      const totalPlayers = await User.countDocuments();
      const onlinePlayers = await User.countDocuments({ status: 'online' });
      const newPlayersToday = await User.countDocuments({ createdAt: { $gte: new Date().setHours(0, 0, 0, 0) } });
      res.json({ success: true, data: { totalPlayers, onlinePlayers, newPlayersToday } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getFullStatistics(req, res) {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const totalPlayers = await User.countDocuments();
      const onlinePlayers = await User.countDocuments({ status: 'online' });
      const newToday = await User.countDocuments({ createdAt: { $gte: today } });
      const activeToday = (await ActionLog.distinct('userId', { createdAt: { $gte: today } })).length;
      const battlesToday = await ActionLog.countDocuments({ createdAt: { $gte: today }, category: 'combat' });
      const tradesToday = await ActionLog.countDocuments({ createdAt: { $gte: today }, category: 'economy', action: 'trade' });
      const dailyActive = [];
      for (let i = 6; i >= 0; i--) {
        const ds = new Date(Date.now() - i * 86400000); ds.setHours(0, 0, 0, 0);
        const de = new Date(ds.getTime() + 86400000);
        dailyActive.push({ date: ds.toISOString().split('T')[0], count: (await ActionLog.distinct('userId', { createdAt: { $gte: ds, $lt: de } })).length });
      }
      res.json({ success: true, data: { totalPlayers, onlinePlayers, newToday, activeToday, battlesToday, tradesToday, dailyActive } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getBattleLogs(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const logs = await BattleLog.find().sort({ startedAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
      const total = await BattleLog.countDocuments();
      res.json({ success: true, data: { logs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ==================== 行为日志 ====================

  async getActionLogs(req, res) {
    try { res.json({ success: true, data: await actionLogService.queryLogs(req.query) }); }
    catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getActionLogStats(req, res) {
    try {
      const stats = await actionLogService.getLogStats(parseInt(req.query.days) || 7);
      res.json({ success: true, data: stats });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ==================== 配置管理：任务 ====================

  async getQuestConfigs(req, res) {
    try {
      const quests = readConfig('quests');
      res.json({ success: true, data: quests });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async createQuestConfig(req, res) {
    try {
      const quests = readConfig('quests');
      const newQuest = req.body;
      if (quests.find(q => q.id === newQuest.id)) return res.status(400).json({ success: false, message: '任务ID已存在' });
      quests.push(newQuest);
      writeConfig('quests', quests);
      res.json({ success: true, message: '任务创建成功', data: newQuest });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async updateQuestConfig(req, res) {
    try {
      const quests = readConfig('quests');
      const idx = quests.findIndex(q => q.id === req.params.questId);
      if (idx === -1) return res.status(404).json({ success: false, message: '任务不存在' });
      quests[idx] = { ...quests[idx], ...req.body, id: quests[idx].id };
      writeConfig('quests', quests);
      res.json({ success: true, message: '任务更新成功', data: quests[idx] });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async deleteQuestConfig(req, res) {
    try {
      let quests = readConfig('quests');
      const before = quests.length;
      quests = quests.filter(q => q.id !== req.params.questId);
      if (quests.length === before) return res.status(404).json({ success: false, message: '任务不存在' });
      writeConfig('quests', quests);
      res.json({ success: true, message: '任务已删除' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ==================== 配置管理：道具 ====================

  async getItemConfigs(req, res) {
    try {
      const items = readConfig('items');
      const { type } = req.query;
      res.json({ success: true, data: type ? items.filter(i => i.type === type) : items });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async createItemConfig(req, res) {
    try {
      const items = readConfig('items');
      const newItem = req.body;
      if (items.find(i => i.id === newItem.id)) return res.status(400).json({ success: false, message: '道具ID已存在' });
      items.push(newItem);
      writeConfig('items', items);
      res.json({ success: true, message: '道具创建成功', data: newItem });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async updateItemConfig(req, res) {
    try {
      const items = readConfig('items');
      const idx = items.findIndex(i => i.id === req.params.itemId);
      if (idx === -1) return res.status(404).json({ success: false, message: '道具不存在' });
      items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
      writeConfig('items', items);
      res.json({ success: true, message: '道具更新成功', data: items[idx] });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async deleteItemConfig(req, res) {
    try {
      let items = readConfig('items');
      const before = items.length;
      items = items.filter(i => i.id !== req.params.itemId);
      if (items.length === before) return res.status(404).json({ success: false, message: '道具不存在' });
      writeConfig('items', items);
      res.json({ success: true, message: '道具已删除' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // ==================== 配置管理：地图/房间 ====================

  async getMapConfigs(req, res) {
    try {
      const maps = readConfig('maps');
      const rooms = readConfig('rooms');
      const mapsWithStats = maps.map(m => ({
        ...m,
        roomCount: rooms.filter(r => r.mapId === m.id || (r.id && r.id.startsWith(m.id))).length
      }));
      res.json({ success: true, data: mapsWithStats });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getRoomConfigs(req, res) {
    try {
      const rooms = readConfig('rooms');
      const { mapId } = req.query;
      const filtered = mapId ? rooms.filter(r => r.mapId === mapId || (r.id && r.id.startsWith(mapId))) : rooms;
      res.json({ success: true, data: filtered });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async updateRoomConfig(req, res) {
    try {
      const rooms = readConfig('rooms');
      const idx = rooms.findIndex(r => r.id === req.params.roomId);
      if (idx === -1) return res.status(404).json({ success: false, message: '房间不存在' });
      rooms[idx] = { ...rooms[idx], ...req.body, id: rooms[idx].id };
      writeConfig('rooms', rooms);
      res.json({ success: true, message: '房间更新成功', data: rooms[idx] });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async createRoomConfig(req, res) {
    try {
      const rooms = readConfig('rooms');
      const newRoom = req.body;
      if (!newRoom.id || !newRoom.name) return res.status(400).json({ success: false, message: '房间ID和名称不能为空' });
      if (rooms.find(r => r.id === newRoom.id)) return res.status(400).json({ success: false, message: '房间ID已存在' });
      // 默认值
      newRoom.exits = newRoom.exits || [];
      newRoom.monsters = newRoom.monsters || [];
      newRoom.npcs = newRoom.npcs || [];
      newRoom.features = newRoom.features || [];
      rooms.push(newRoom);
      writeConfig('rooms', rooms);
      // 同步地图的 rooms 列表
      if (newRoom.mapId) {
        const maps = readConfig('maps');
        const map = maps.find(m => m.id === newRoom.mapId);
        if (map && !map.rooms.includes(newRoom.id)) {
          map.rooms.push(newRoom.id);
          writeConfig('maps', maps);
        }
      }
      res.json({ success: true, message: '房间创建成功', data: newRoom });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async deleteRoomConfig(req, res) {
    try {
      const rooms = readConfig('rooms');
      const idx = rooms.findIndex(r => r.id === req.params.roomId);
      if (idx === -1) return res.status(404).json({ success: false, message: '房间不存在' });
      const removed = rooms.splice(idx, 1)[0];
      writeConfig('rooms', rooms);
      // 同步地图的 rooms 列表
      if (removed.mapId) {
        const maps = readConfig('maps');
        const map = maps.find(m => m.id === removed.mapId);
        if (map) {
          map.rooms = map.rooms.filter(rid => rid !== removed.id);
          writeConfig('maps', maps);
        }
      }
      res.json({ success: true, message: '房间删除成功' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async updateMapConfig(req, res) {
    try {
      const maps = readConfig('maps');
      const idx = maps.findIndex(m => m.id === req.params.mapId);
      if (idx === -1) return res.status(404).json({ success: false, message: '地图不存在' });
      maps[idx] = { ...maps[idx], ...req.body, id: maps[idx].id };
      writeConfig('maps', maps);
      res.json({ success: true, message: '地图更新成功', data: maps[idx] });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getNpcList(req, res) {
    try {
      const npcs = readConfig('npcs');
      res.json({ success: true, data: npcs });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  async getMonsterList(req, res) {
    try {
      const monsters = readConfig('monsters');
      res.json({ success: true, data: monsters });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // 可疑玩家列表
  async getSuspiciousPlayers(req, res) {
    try {
      const { minLevel = 2 } = req.query;
      const players = await antiCheatService.getSuspiciousPlayers(parseInt(minLevel));
      res.json({ success: true, data: players });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }

  // 重置玩家可疑状态
  async resetSuspicion(req, res) {
    try {
      antiCheatService.resetSuspicion(req.params.playerId);
      res.json({ success: true, message: '可疑状态已重置' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
  }
}

module.exports = new GMController();
