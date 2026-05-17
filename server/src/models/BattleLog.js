const mongoose = require('mongoose');

const BattleLogSchema = new mongoose.Schema({
  // 战斗ID
  battleId: {
    type: String,
    required: true,
    unique: true
  },
  // 战斗类型
  type: {
    type: String,
    enum: ['pve', 'pvp', 'boss'],
    required: true
  },
  // 参与者
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    level: Number,
    hp: Number,
    maxHp: Number,
    isWinner: Boolean
  }],
  // 怪物信息（PVE时）
  monster: {
    id: String,
    name: String,
    level: Number,
    hp: Number,
    maxHp: Number
  },
  // 战斗回合
  rounds: [{
    round: Number,
    attacker: String,
    defender: String,
    action: String,
    skill: String,
    skillType: String,
    damage: Number,
    healed: Number,
    mpCost: Number,
    hpCost: Number,
    reflectedDamage: Number,
    skipped: Boolean,
    dodged: Boolean,
    defending: Boolean,
    fled: Boolean,
    mutualDefeat: Boolean,
    remainingHp: Number,
    remainingMp: Number,
    effectMessages: [String],
    timestamp: Date
  }],
  // 战斗结果
  result: {
    winner: String,
    expGained: Number,
    goldGained: Number,
    itemsDropped: [String]
  },
  // 时间戳
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  duration: {
    type: Number  // 秒
  }
});

BattleLogSchema.index({ 'participants.userId': 1 });


module.exports = mongoose.model('BattleLog', BattleLogSchema);
