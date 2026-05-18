const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  characterName: { type: String, required: true },
  category: { type: String, enum: ['combat', 'economy', 'movement', 'skill', 'quest', 'faction', 'chat', 'system', 'gm_action'], required: true },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  roomId: { type: String, default: null },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  ipAddress: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
});

ActionLogSchema.index({ userId: 1, createdAt: -1 });
ActionLogSchema.index({ category: 1, createdAt: -1 });
ActionLogSchema.index({ characterName: 1, createdAt: -1 });

module.exports = mongoose.model('ActionLog', ActionLogSchema);
