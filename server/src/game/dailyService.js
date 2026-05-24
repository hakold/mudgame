const Daily = require('../models/Daily');
const User = require('../models/User');

// 签到奖励（连续签到递增）
const checkInRewards = [
  { exp: 50, gold: 20 },    // day 1
  { exp: 80, gold: 30 },    // day 2
  { exp: 120, gold: 40 },   // day 3
  { exp: 150, gold: 50 },   // day 4
  { exp: 200, gold: 80 },   // day 5
  { exp: 250, gold: 100 },  // day 6
  { exp: 400, gold: 200 }   // day 7
];

// 每日任务定义
const dailyTaskDefs = [
  { id: 'daily_kill_5', name: '斩妖除魔', description: '击杀5只怪物', type: 'kill', target: 5, reward: { exp: 100, gold: 50, activityPoints: 10 } },
  { id: 'daily_move_10', name: '行侠仗义', description: '移动10次', type: 'move', target: 10, reward: { exp: 80, gold: 40, activityPoints: 10 } },
  { id: 'daily_talk_3', name: '广交豪杰', description: '与3位NPC对话', type: 'talk', target: 3, reward: { exp: 60, gold: 30, activityPoints: 10 } },
  { id: 'daily_collect_5', name: '采集能手', description: '采集5次', type: 'gather', target: 5, reward: { exp: 100, gold: 60, activityPoints: 15 } },
  { id: 'daily_battle_3', name: '百战不殆', description: '完成3场战斗', type: 'battle', target: 3, reward: { exp: 150, gold: 80, activityPoints: 15 } },
  { id: 'daily_trade_1', name: '互通有无', description: '完成1次交易', type: 'trade', target: 1, reward: { exp: 120, gold: 100, activityPoints: 20 } }
];

// 活跃度奖励
const activityRewards = [
  { points: 30, reward: { exp: 100, gold: 50 } },
  { points: 60, reward: { exp: 200, gold: 100 } },
  { points: 100, reward: { exp: 500, gold: 300 } }
];

// 获取或创建用户的每日状态
async function getOrCreateDaily(userId) {
  const today = new Date().toISOString().split('T')[0];
  let daily = await Daily.findOne({ userId });
  if (!daily || daily.date !== today) {
    if (daily) {
      // 跨天重置
      daily.activityPoints = 0;
      daily.dailyTasks = new Map();
      daily.dailyTasksClaimed = new Map();
      daily.activityRewardsClaimed = [];
      // 重置 v2 每日活跃任务
      daily.dailyV2Tasks = { checkedIn: false, fished: false, herbed: false, crafted: false };
      daily.dailyRewardClaimed = false;
      daily.date = today;
      // 签到：如果昨天签到了就保留连签，否则重置
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (daily.lastCheckInDate) {
        const lastDate = daily.lastCheckInDate.toISOString().split('T')[0];
        if (lastDate !== yesterdayStr && lastDate !== today) {
          daily.checkInStreak = 0;
        }
      }
    } else {
      daily = new Daily({ userId, date: today });
    }
    await daily.save();
  }
  return daily;
}

// 签到
async function checkIn(userId) {
  const today = new Date().toISOString().split('T')[0];
  const daily = await getOrCreateDaily(userId);

  if (daily.lastCheckInDate) {
    const lastDate = daily.lastCheckInDate.toISOString().split('T')[0];
    if (lastDate === today) {
      return { error: '今日已签到' };
    }
  }

  daily.lastCheckInDate = new Date();
  daily.checkInStreak = Math.min(daily.checkInStreak + 1, 7);
  // 标记 v2 每日活跃：签到完成
  if (!daily.dailyV2Tasks) daily.dailyV2Tasks = { checkedIn: false, fished: false, herbed: false, crafted: false };
  daily.dailyV2Tasks.checkedIn = true;
  await daily.save();

  const rewardIdx = (daily.checkInStreak - 1) % 7;
  const reward = checkInRewards[rewardIdx];

  const user = await User.findById(userId);
  if (user) {
    user.exp += reward.exp;
    user.gold += reward.gold;
    await user.save();
  }

  return {
    success: true,
    streak: daily.checkInStreak,
    reward: { ...reward },
    activityPoints: daily.activityPoints
  };
}

// 获取每日任务列表
function getDailyTasks() {
  return dailyTaskDefs;
}

// 更新每日任务进度
async function updateDailyTaskProgress(userId, taskType, amount = 1) {
  const daily = await getOrCreateDaily(userId);
  let updated = false;

  for (const task of dailyTaskDefs) {
    if (task.type === taskType) {
      const current = daily.dailyTasks.get(task.id) || 0;
      if (current < task.target && !daily.dailyTasksClaimed.get(task.id)) {
        daily.dailyTasks.set(task.id, Math.min(current + amount, task.target));
        updated = true;
      }
    }
  }

  if (updated) await daily.save();
  return daily;
}

// 领取每日任务奖励
async function claimDailyTask(userId, taskId) {
  const daily = await getOrCreateDaily(userId);
  const task = dailyTaskDefs.find(t => t.id === taskId);
  if (!task) return { error: '任务不存在' };

  if (daily.dailyTasksClaimed.get(taskId)) {
    return { error: '已领取此任务奖励' };
  }

  const progress = daily.dailyTasks.get(taskId) || 0;
  if (progress < task.target) {
    return { error: `任务未完成 (${progress}/${task.target})` };
  }

  daily.dailyTasksClaimed.set(taskId, true);
  daily.activityPoints += task.reward.activityPoints;
  await daily.save();

  const user = await User.findById(userId);
  if (user) {
    user.exp += task.reward.exp;
    user.gold += task.reward.gold;
    await user.save();
  }

  return {
    success: true,
    taskId,
    reward: task.reward,
    activityPoints: daily.activityPoints
  };
}

// 领取活跃度奖励
async function claimActivityReward(userId, points) {
  const daily = await getOrCreateDaily(userId);
  const rewardDef = activityRewards.find(r => r.points === points);
  if (!rewardDef) return { error: '奖励档位不存在' };

  if (daily.activityPoints < points) {
    return { error: `活跃度不足，当前 ${daily.activityPoints}/${points}` };
  }

  if (daily.activityRewardsClaimed.includes(points)) {
    return { error: '已领取此档位奖励' };
  }

  daily.activityRewardsClaimed.push(points);
  await daily.save();

  const user = await User.findById(userId);
  if (user) {
    user.exp += rewardDef.reward.exp;
    user.gold += rewardDef.reward.gold;
    await user.save();
  }

  return {
    success: true,
    points,
    reward: rewardDef.reward,
    activityPoints: daily.activityPoints
  };
}

// 获取每日状态
async function getDailyStatus(userId) {
  const daily = await getOrCreateDaily(userId);
  return {
    streak: daily.checkInStreak,
    lastCheckIn: daily.lastCheckInDate,
    activityPoints: daily.activityPoints,
    tasks: dailyTaskDefs.map(t => ({
      ...t,
      progress: daily.dailyTasks.get(t.id) || 0,
      claimed: !!daily.dailyTasksClaimed.get(t.id)
    })),
    activityRewards: activityRewards.map(r => ({
      ...r,
      claimed: daily.activityRewardsClaimed.includes(r.points)
    }))
  };
}

// ==================== 简化每日活跃 v2 ====================

// 检查是否所有四项活跃任务完成
function allV2TasksDone(daily) {
  const tasks = daily.dailyV2Tasks || {};
  return tasks.checkedIn && tasks.fished && tasks.herbed && tasks.crafted;
}

// 获取 v2 每日活跃状态
async function getDailyV2Status(userId) {
  const daily = await getOrCreateDaily(userId);
  const tasks = daily.dailyV2Tasks || { checkedIn: false, fished: false, herbed: false, crafted: false };
  return {
    tasks: {
      checkedIn: tasks.checkedIn,
      fished: tasks.fished,
      herbed: tasks.herbed,
      crafted: tasks.crafted
    },
    allDone: tasks.checkedIn && tasks.fished && tasks.herbed && tasks.crafted,
    rewardClaimed: !!daily.dailyRewardClaimed,
    streak: daily.checkInStreak
  };
}

// 标记生活技能采集：钓鱼 / 采药
async function markLifeSkillProgress(userId, skillType) {
  const daily = await getOrCreateDaily(userId);
  if (!daily.dailyV2Tasks) daily.dailyV2Tasks = { checkedIn: false, fished: false, herbed: false, crafted: false };
  let updated = false;

  if (skillType === 'fishing' && !daily.dailyV2Tasks.fished) {
    daily.dailyV2Tasks.fished = true;
    updated = true;
  } else if (skillType === 'herb' && !daily.dailyV2Tasks.herbed) {
    daily.dailyV2Tasks.herbed = true;
    updated = true;
  }

  if (updated) await daily.save();
  return daily;
}

// 标记制造技能：锻造/制药/烹饪 (三选一，任一完成就算)
async function markCraftProgress(userId) {
  const daily = await getOrCreateDaily(userId);
  if (!daily.dailyV2Tasks) daily.dailyV2Tasks = { checkedIn: false, fished: false, herbed: false, crafted: false };

  if (!daily.dailyV2Tasks.crafted) {
    daily.dailyV2Tasks.crafted = true;
    await daily.save();
  }
  return daily;
}

// 领取每日活跃宝箱奖励
async function claimDailyV2Reward(userId) {
  const daily = await getOrCreateDaily(userId);
  const tasks = daily.dailyV2Tasks || { checkedIn: false, fished: false, herbed: false, crafted: false };

  if (!tasks.checkedIn) return { error: '尚未完成签到' };
  if (!tasks.fished) return { error: '尚未完成钓鱼' };
  if (!tasks.herbed) return { error: '尚未完成采药' };
  if (!tasks.crafted) return { error: '尚未完成制造（锻造/制药/烹饪任选其一）' };
  if (daily.dailyRewardClaimed) return { error: '今日宝箱已领取' };

  daily.dailyRewardClaimed = true;
  await daily.save();

  return {
    success: true,
    chestItemId: 'item_daily_chest',
    chestName: '每日活跃宝箱',
    message: '🎉 今日活跃任务全部完成！获得「每日活跃宝箱」×1'
  };
}

module.exports = {
  checkIn,
  getDailyTasks,
  getDailyStatus,
  updateDailyTaskProgress,
  claimDailyTask,
  claimActivityReward,
  getOrCreateDaily,
  dailyTaskDefs,
  activityRewards,
  checkInRewards,
  // v2 methods
  getDailyV2Status,
  markLifeSkillProgress,
  markCraftProgress,
  claimDailyV2Reward
};
