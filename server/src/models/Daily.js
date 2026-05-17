const mongoose = require('mongoose');

const DailySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // 签到
  checkInStreak: { type: Number, default: 0 },
  lastCheckInDate: { type: Date, default: null },
  // 活跃度
  activityPoints: { type: Number, default: 0 },
  // 每日任务进度 { taskId: progress }
  dailyTasks: { type: Map, of: Number, default: {} },
  // 每日任务领取状态 { taskId: true }
  dailyTasksClaimed: { type: Map, of: Boolean, default: {} },
  // 活跃度奖励领取状态 [0, 30, 60, 100]
  activityRewardsClaimed: { type: [Number], default: [] },
  // 重置日期
  date: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

DailySchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Daily', DailySchema);
