const mongoose = require('mongoose');

const QuestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questId: {
    type: String,
    required: true  // 任务配置ID
  },
  status: {
    type: String,
    enum: ['available', 'accepted', 'in_progress', 'completed', 'failed'],
    default: 'accepted'
  },
  // 任务进度
  progress: {
    type: Map,
    of: Number,
    default: {}
  },
  // 接取时间
  acceptedAt: {
    type: Date,
    default: Date.now
  },
  // 完成时间
  completedAt: {
    type: Date,
    default: null
  },
  // 是否已领取奖励
  rewardClaimed: {
    type: Boolean,
    default: false
  }
});

// 获取任务配置
QuestSchema.methods.getQuestConfig = function() {
  const questConfigs = require('../../config/json/quests.json');
  return questConfigs.find(q => q.id === this.questId);
};

// 检查任务条件是否满足
QuestSchema.methods.checkCompletion = function() {
  const config = this.getQuestConfig();
  if (!config) return false;
  
  for (const objective of config.objectives) {
    const current = this.progress.get(objective.id) || 0;
    if (current < objective.target) return false;
  }
  
  return true;
};

// 更新进度
QuestSchema.methods.updateProgress = function(objectiveId, amount) {
  const current = this.progress.get(objectiveId) || 0;
  this.progress.set(objectiveId, current + amount);
  
  if (this.checkCompletion()) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
};

// 完成任务
QuestSchema.methods.complete = function() {
  if (this.status !== 'completed') return false;
  this.rewardClaimed = true;
  return true;
};

module.exports = mongoose.model('Quest', QuestSchema);
