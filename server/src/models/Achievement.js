const mongoose = require('mongoose');

const AchievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievementId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  category: String,
  rewards: {
    exp: Number,
    gold: Number,
    title: String
  },
  achievedAt: {
    type: Date,
    default: Date.now
  }
});

AchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model('Achievement', AchievementSchema);