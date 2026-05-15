const mongoose = require('mongoose');

const CharacterSkillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skillId: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  exp: {
    type: Number,
    default: 0
  },
  proficiency: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  learned: {
    type: Boolean,
    default: true
  },
  learnedAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: null
  }
});

CharacterSkillSchema.methods.getSkillConfig = function() {
  const { getSkill } = require('../game');
  return getSkill(this.skillId);
};

// 计算技能伤害（基于配置的 damage 数组 [min, max]，随等级提升）
CharacterSkillSchema.methods.calculateDamage = function(userAttributes) {
  const config = this.getSkillConfig();
  if (!config || !config.damage) return 0;

  const [min, max] = config.damage;
  const levelScale = 1 + (this.level - 1) * 0.1; // 每级 +10%
  const base = min + Math.random() * (max - min);
  return Math.floor(base * levelScale);
};

// 计算技能治疗量
CharacterSkillSchema.methods.calculateHeal = function() {
  const config = this.getSkillConfig();
  if (!config || !config.heal) return 0;

  const [min, max] = config.heal;
  const levelScale = 1 + (this.level - 1) * 0.1;
  const base = min + Math.random() * (max - min);
  return Math.floor(base * levelScale);
};

// 计算技能消耗（mpCost 随等级微增）
CharacterSkillSchema.methods.calculateCost = function() {
  const config = this.getSkillConfig();
  if (!config) return 0;

  const baseCost = config.mpCost || 0;
  const hpCost = config.hpCost || 0;
  const levelScale = 1 + (this.level - 1) * 0.05; // 每级 +5% 消耗
  return {
    mp: Math.floor(baseCost * levelScale),
    hp: Math.floor(hpCost * levelScale)
  };
};

// 计算冷却时间
CharacterSkillSchema.methods.calculateCooldown = function() {
  const config = this.getSkillConfig();
  if (!config) return 0;

  const baseCooldown = config.cooldown || 0;
  const reduction = (this.level - 1) * 0.5; // 每级减少 0.5 秒
  return Math.max(0, baseCooldown - reduction);
};

// 获取下一级所需经验
CharacterSkillSchema.methods.getExpToNextLevel = function() {
  return Math.floor(100 * Math.pow(this.level, 1.5));
};

// 检查是否可以升级
CharacterSkillSchema.methods.canLevelUp = function() {
  if (this.level >= 10) return false;
  return this.exp >= this.getExpToNextLevel();
};

// 升级
CharacterSkillSchema.methods.levelUp = function() {
  if (!this.canLevelUp()) return false;

  this.exp -= this.getExpToNextLevel();
  this.level += 1;
  return true;
};

module.exports = mongoose.model('CharacterSkill', CharacterSkillSchema);