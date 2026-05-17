const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // 账号信息
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // 角色信息
  characterName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 12
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  faction: {
    type: String,
    default: null  // 门派ID
  },
  // 门派声望
  factionReputation: {
    type: Number,
    default: 0,
    min: 0
  },
  // 门派贡献
  factionContribution: {
    type: Number,
    default: 0,
    min: 0
  },
  // 门派等级（弟子→执事→长老→掌门）
  factionRank: {
    type: String,
    enum: ['disciple', 'deacon', 'elder', 'leader'],
    default: 'disciple'
  },
  
  // 属性
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  exp: {
    type: Number,
    default: 0,
    min: 0
  },

  // 统计数据（成就系统用）
  stats: {
    battlesWon: { type: Number, default: 0 },
    pvpBattles: { type: Number, default: 0 },
    tradesCompleted: { type: Number, default: 0 },
    goldEarned: { type: Number, default: 0 },
    roomsVisited: [{ type: String }],
    questsCompleted: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 }
  },

  // 基础属性
  attributes: {
    strength: { type: Number, default: 10 },      // 力量
    dexterity: { type: Number, default: 10 },     // 敏捷
    constitution: { type: Number, default: 10 },  // 体质
    intelligence: { type: Number, default: 10 }, // 悟性
    charisma: { type: Number, default: 10 }       // 根骨
  },
  
  // 可分配点数
  freePoints: {
    type: Number,
    default: 0
  },
  
  // 战斗属性（计算得出）
  hp: {
    current: { type: Number, default: 100 },
    max: { type: Number, default: 100 }
  },
  mp: {
    current: { type: Number, default: 50 },
    max: { type: Number, default: 50 }
  },
  
  // 金钱
  gold: {
    type: Number,
    default: 100,
    min: 0
  },
  
  // 位置
  location: {
    mapId: { type: String, default: 'village' },
    roomId: { type: String, default: 'village_center' }
  },
  
  // 状态
  status: {
    type: String,
    enum: ['online', 'offline', 'fighting', 'dead'],
    default: 'offline'
  },
  
  // 权限
  role: {
    type: String,
    enum: ['player', 'gm', 'admin'],
    default: 'player'
  },
  
  // 时间戳
  lastLogin: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 密码加密
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 验证密码
UserSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// 计算最大HP
UserSchema.methods.calculateMaxHP = function() {
  const base = 100;
  const conBonus = this.attributes.constitution * 10;
  const levelBonus = this.level * 5;
  return base + conBonus + levelBonus;
};

// 计算最大MP
UserSchema.methods.calculateMaxMP = function() {
  const base = 50;
  const intBonus = this.attributes.intelligence * 5;
  const levelBonus = this.level * 2;
  return base + intBonus + levelBonus;
};

// 计算攻击力
UserSchema.methods.calculateAttack = function() {
  return this.attributes.strength * 2 + this.level;
};

// 计算防御力
UserSchema.methods.calculateDefense = function() {
  return this.attributes.constitution + this.level;
};

// 计算闪避
UserSchema.methods.calculateDodge = function() {
  return Math.floor(this.attributes.dexterity / 2);
};

// 计算下一级所需经验
UserSchema.methods.getExpToNextLevel = function() {
  const config = require('../config');
  return Math.floor(config.game.expBase * Math.pow(this.level, config.game.expExponent));
};

// 检查是否可以升级
UserSchema.methods.canLevelUp = function() {
  if (this.level >= 100) return false;
  return this.exp >= this.getExpToNextLevel();
};

// 升级
UserSchema.methods.levelUp = function() {
  if (!this.canLevelUp()) return false;
  
  this.exp -= this.getExpToNextLevel();
  this.level += 1;
  this.freePoints += 3;  // 每级获得3点自由属性点
  
  // 更新HP/MP上限
  this.hp.max = this.calculateMaxHP();
  this.mp.max = this.calculateMaxMP();
  this.hp.current = this.hp.max;
  this.mp.current = this.mp.max;
  
  return true;
};

// 死亡惩罚
UserSchema.methods.applyDeathPenalty = function() {
  // 经验损失10%（不低于0）
  const expLoss = Math.floor(this.exp * 0.1);
  this.exp = Math.max(0, this.exp - expLoss);
  
  // 金币损失5%（不低于0）
  const goldLoss = Math.floor(this.gold * 0.05);
  this.gold = Math.max(0, this.gold - goldLoss);
  
  return { expLoss, goldLoss };
};

// 复活
UserSchema.methods.revive = function() {
  this.hp.current = Math.floor(this.hp.max * 0.3);  // 复活后30% HP
  this.mp.current = Math.floor(this.mp.max * 0.3);  // 复活后30% MP
  this.status = 'online';
  // 复活后回到村庄
  this.location.mapId = 'village';
  this.location.roomId = 'village_center';
  return true;
};

// 检查门派进阶条件
UserSchema.methods.canFactionAdvance = function() {
  const rankRequirements = {
    disciple: { reputation: 100, level: 10 },  // 弟子→执事
    deacon: { reputation: 500, level: 25 },     // 执事→长老
    elder: { reputation: 2000, level: 50 },     // 长老→掌门
    leader: null  // 掌门无法再进阶
  };
  
  const req = rankRequirements[this.factionRank];
  if (!req) return false;
  
  return this.factionReputation >= req.reputation && this.level >= req.level;
};

// 门派进阶
UserSchema.methods.factionAdvance = function() {
  if (!this.canFactionAdvance()) return false;
  
  const rankOrder = ['disciple', 'deacon', 'elder', 'leader'];
  const currentIdx = rankOrder.indexOf(this.factionRank);
  this.factionRank = rankOrder[currentIdx + 1];
  
  // 进阶奖励：额外属性点
  this.freePoints += 5;
  
  return true;
};

module.exports = mongoose.model('User', UserSchema);
