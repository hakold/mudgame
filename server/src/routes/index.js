const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const playerController = require('../controllers/playerController');
const gmController = require('../controllers/gmController');
const { gameConfig } = require('../game');
const { authMiddleware, gmMiddleware, adminMiddleware } = require('../middleware/auth');

// ==================== 公开路由 ====================

// 认证相关
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/reset-password', authController.resetPassword);

// 游戏配置（公开）
router.get('/game/config', (req, res) => {
  res.json({
    success: true,
    data: gameConfig
  });
});

// 公告（公开）
router.get('/announcements', gmController.getAnnouncements);

// ==================== 用户路由 ====================

router.use(authMiddleware);

// 用户信息
router.get('/user/me', authController.getCurrentUser);
router.post('/user/change-password', authController.changePassword);

// 玩家信息
router.get('/player/info', playerController.getPlayerInfo);
router.post('/player/attributes', playerController.updateAttributes);
router.get('/player/inventory', playerController.getInventory);
router.get('/player/skills', playerController.getSkills);
router.get('/player/quests', playerController.getQuests);
router.post('/player/move', playerController.move);

// 在线玩家
router.get('/players/online', playerController.getOnlinePlayers);
router.get('/players/:playerId', playerController.viewPlayer);

// ==================== GM路由 ====================

router.use(gmMiddleware);

// 玩家管理
router.get('/gm/players', gmController.getAllPlayers);
router.put('/gm/players/:playerId', gmController.modifyPlayer);
router.post('/gm/players/:playerId/ban', gmController.banPlayer);
router.post('/gm/players/:playerId/item', gmController.giveItem);
router.post('/gm/players/:playerId/gold', gmController.giveGold);

// 公告管理
router.post('/gm/announcements', gmController.createAnnouncement);
router.delete('/gm/announcements/:announcementId', gmController.deleteAnnouncement);

// 统计
router.get('/gm/statistics', gmController.getStatistics);
router.get('/gm/statistics/full', gmController.getFullStatistics);
router.get('/gm/battle-logs', gmController.getBattleLogs);

// 行为日志
router.get('/gm/action-logs', gmController.getActionLogs);
router.get('/gm/action-logs/stats', gmController.getActionLogStats);

// 配置管理
router.get('/gm/config/quests', gmController.getQuestConfigs);
router.post('/gm/config/quests', gmController.createQuestConfig);
router.put('/gm/config/quests/:questId', gmController.updateQuestConfig);
router.delete('/gm/config/quests/:questId', gmController.deleteQuestConfig);
router.get('/gm/config/items', gmController.getItemConfigs);
router.post('/gm/config/items', gmController.createItemConfig);
router.put('/gm/config/items/:itemId', gmController.updateItemConfig);
router.delete('/gm/config/items/:itemId', gmController.deleteItemConfig);
router.get('/gm/config/maps', gmController.getMapConfigs);
router.get('/gm/config/rooms', gmController.getRoomConfigs);
router.put('/gm/config/rooms/:roomId', gmController.updateRoomConfig);

// 玩家详情
router.get('/gm/players/:playerId/full', gmController.getPlayerFullInfo);
router.get('/gm/players/:playerId/equipment', gmController.getPlayerEquipment);
router.get('/gm/players/:playerId/skills', gmController.getPlayerSkills);
router.get('/gm/players/:playerId/inventory', gmController.getPlayerInventory);
router.put('/gm/players/:playerId/attributes', gmController.modifyPlayerAttributes);
router.post('/gm/players/:playerId/reset', gmController.resetPlayer);

module.exports = router;
