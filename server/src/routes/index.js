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
router.get('/gm/battle-logs', gmController.getBattleLogs);

module.exports = router;
