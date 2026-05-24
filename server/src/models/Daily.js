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
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },

  // ===== 简化每日活跃 v2 =====
  // 四项活跃任务完成状态（每天重置）
  dailyV2Tasks: {
    checkedIn: { type: Boolean, default: false },       // 签到
    fished: { type: Boolean, default: false },           // 钓鱼1次
    herbed: { type: Boolean, default: false },           // 采药1次
    crafted: { type: Boolean, default: false }            // 锻造/制药/烹饪1次 (三选一)
  },
  // 每日活跃宝箱是否已领取
  dailyRewardClaimed: { type: Boolean, default: false }
});

DailySchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Daily', DailySchema);
