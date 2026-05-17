const mongoose = require('mongoose');

const GangMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['leader', 'vice_leader', 'elder', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  contribution: { type: Number, default: 0 }
}, { _id: false });

const GangSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  level: { type: Number, default: 1, min: 1, max: 5 },
  exp: { type: Number, default: 0 },
  members: [GangMemberSchema],
  // 帮派仓库 [{ itemId, quantity, depositedBy, depositedAt }]
  warehouse: [{
    itemId: String,
    itemName: String,
    quantity: Number,
    depositedBy: String,
    depositedAt: { type: Date, default: Date.now }
  }],
  // 帮战
  warDeclarations: [{
    targetGangId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gang' },
    targetGangName: String,
    declaredBy: String,
    declaredAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'ended'], default: 'pending' }
  }],
  createdAt: { type: Date, default: Date.now }
});

// 帮派升级所需经验和成员数
GangSchema.statics.levelRequirements = [
  { level: 1, expNeeded: 0, memberMin: 1, bonus: { exp: 0.02, gold: 0.02 } },
  { level: 2, expNeeded: 500, memberMin: 3, bonus: { exp: 0.05, gold: 0.05 } },
  { level: 3, expNeeded: 2000, memberMin: 5, bonus: { exp: 0.08, gold: 0.08 } },
  { level: 4, expNeeded: 5000, memberMin: 8, bonus: { exp: 0.12, gold: 0.12 } },
  { level: 5, expNeeded: 15000, memberMin: 12, bonus: { exp: 0.20, gold: 0.15 } }
];

GangSchema.methods.getBonus = function() {
  const req = Gang.levelRequirements.find(r => r.level === this.level);
  return req?.bonus || { exp: 0, gold: 0 };
};

GangSchema.methods.canLevelUp = function() {
  const nextLevel = Gang.levelRequirements.find(r => r.level === this.level + 1);
  if (!nextLevel) return false;
  return this.exp >= nextLevel.expNeeded && this.members.length >= nextLevel.memberMin;
};

GangSchema.methods.getMember = function(userId) {
  return this.members.find(m => m.userId.toString() === userId.toString());
};

GangSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Gang', GangSchema);
