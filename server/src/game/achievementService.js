// 成就系统服务
const { Achievement } = require('../models');
const achievementsConfig = require('../../../config/json/achievements.json');

class AchievementService {
  constructor() {
    this.achievements = new Map();
    achievementsConfig.forEach(a => this.achievements.set(a.id, a));
  }

  // 检查玩家是否达成某个成就
  async checkAchievement(userId, achievementId, stats) {
    const config = this.achievements.get(achievementId);
    if (!config) return null;

    // 检查是否已获得
    const existing = await Achievement.findOne({ userId, achievementId });
    if (existing) return null;

    const condition = config.condition;
    let met = false;

    switch (condition.type) {
      case 'battle_count':
        met = (stats.battles || 0) >= condition.value;
        break;
      case 'level':
        met = (stats.level || 0) >= condition.value;
        break;
      case 'gold_earned':
        met = (stats.goldEarned || 0) >= condition.value;
        break;
      case 'rooms_visited':
        met = (stats.roomsVisited || 0) >= condition.value;
        break;
      case 'quests_completed':
        met = (stats.questsCompleted || 0) >= condition.value;
        break;
      case 'faction_joined':
        met = !!stats.faction;
        break;
      case 'faction_rank':
        met = stats.factionRank === condition.value;
        break;
      case 'pvp_count':
        met = (stats.pvpBattles || 0) >= condition.value;
        break;
      case 'deaths':
        met = (stats.deaths || 0) >= condition.value;
        break;
      case 'trades_completed':
        met = (stats.trades || 0) >= condition.value;
        break;
    }

    if (!met) return null;

    // 创建成就记录
    const achievement = await Achievement.create({
      userId,
      achievementId,
      name: config.name,
      description: config.description,
      category: config.category,
      rewards: config.rewards,
      achievedAt: new Date()
    });

    return achievement;
  }

  // 批量检查所有成就
  async checkAllAchievements(userId, stats) {
    const newAchievements = [];
    for (const [id, config] of this.achievements) {
      const result = await this.checkAchievement(userId, id, stats);
      if (result) newAchievements.push(result);
    }
    return newAchievements;
  }

  // 获取玩家所有成就
  async getPlayerAchievements(userId) {
    return await Achievement.find({ userId }).sort({ achievedAt: -1 });
  }

  // 获取成就配置
  getAchievementConfig(achievementId) {
    return this.achievements.get(achievementId);
  }

  // 获取所有成就配置
  getAllConfigs() {
    return Array.from(this.achievements.values());
  }
}

module.exports = new AchievementService();