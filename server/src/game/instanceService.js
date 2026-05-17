const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { getItem } = require('./index');

const dungeons = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/dungeons.json'), 'utf-8'));

// 玩家副本状态 { userId: { dungeonId: { runsToday, currentWave, collected, startTime } } }
const instanceStates = new Map();

function getDungeon(dungeonId) {
  return dungeons.find(d => d.id === dungeonId) || null;
}

function getAllDungeons() {
  return dungeons;
}

function getPlayerInstance(userId) {
  if (!instanceStates.has(userId)) instanceStates.set(userId, {});
  return instanceStates.get(userId);
}

// 检查每日次数
async function getDailyRuns(userId, dungeonId) {
  const state = getPlayerInstance(userId);
  const today = new Date().toISOString().split('T')[0];
  if (!state[dungeonId] || state[dungeonId].date !== today) {
    state[dungeonId] = { date: today, runsToday: 0, currentWave: 0, collected: {}, startTime: null };
  }
  return state[dungeonId].runsToday;
}

// 进入副本
async function enterDungeon(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return { error: '副本不存在' };

  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };
  if (user.status !== 'online') return { error: '当前状态无法进入副本' };
  if (user.level < dungeon.requireLevel) {
    return { error: `需要等级 ${dungeon.requireLevel}` };
  }

  // 检查门票
  if (dungeon.requireItem) {
    const ticket = await Inventory.findOne({ userId, itemId: dungeon.requireItem });
    if (!ticket || ticket.quantity < 1) {
      const itemConfig = getItem(dungeon.requireItem);
      return { error: `需要 ${itemConfig?.name || dungeon.requireItem} 作为门票` };
    }
    if (ticket.quantity <= 1) {
      await Inventory.deleteOne({ _id: ticket._id });
    } else {
      ticket.quantity -= 1;
      await ticket.save();
    }
  }

  // 检查每日次数
  const state = getPlayerInstance(userId);
  const today = new Date().toISOString().split('T')[0];
  if (!state[dungeonId] || state[dungeonId].date !== today) {
    state[dungeonId] = { date: today, runsToday: 0, currentWave: 0, collected: {}, startTime: null };
  }
  if (state[dungeonId].runsToday >= dungeon.dailyLimit) {
    return { error: `今日次数已用完 (${dungeon.dailyLimit}/${dungeon.dailyLimit})` };
  }

  state[dungeonId].runsToday += 1;
  state[dungeonId].currentWave = 0;
  state[dungeonId].collected = {};
  state[dungeonId].startTime = Date.now();

  return {
    success: true,
    dungeon: {
      id: dungeon.id,
      name: dungeon.name,
      type: dungeon.type,
      description: dungeon.description,
      waves: dungeon.waves?.length || 0,
      timeLimitMinutes: dungeon.timeLimitMinutes || 0,
      currentWave: 0,
      totalWaves: dungeon.waves?.length || 0,
      runsToday: state[dungeonId].runsToday,
      dailyLimit: dungeon.dailyLimit
    }
  };
}

// 获取副本下一波怪物
async function getNextWave(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon || dungeon.type !== 'trial') return { error: '非试炼副本' };

  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return { error: '尚未进入副本' };

  const nextWave = state[dungeonId].currentWave + 1;
  if (nextWave > dungeon.waves.length) return { complete: true };

  const waveConfig = dungeon.waves[nextWave - 1];
  const monsters = [{ monsterId: waveConfig.monsterId, count: waveConfig.count }];
  if (waveConfig.monsterId2) {
    monsters.push({ monsterId: waveConfig.monsterId2, count: waveConfig.count2 || 1 });
  }

  return {
    wave: nextWave,
    totalWaves: dungeon.waves.length,
    description: waveConfig.description,
    monsters,
    currentHp: null,
    currentMp: null
  };
}

// 标记波次完成
async function completeWave(userId, dungeonId) {
  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return;
  state[dungeonId].currentWave += 1;
}

// 完成副本
async function completeDungeon(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return { error: '副本不存在' };

  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };

  const rewards = dungeon.rewards;
  const result = { exp: 0, gold: 0, items: [] };

  if (rewards) {
    if (rewards.exp) { user.exp += rewards.exp; result.exp = rewards.exp; }
    if (rewards.gold) { user.gold += rewards.gold; result.gold = rewards.gold; }
    if (rewards.items) {
      for (const itemId of rewards.items) {
        let inv = await Inventory.findOne({ userId, itemId });
        if (inv) {
          inv.quantity += 1;
          await inv.save();
        } else {
          await Inventory.create({ userId, itemId, quantity: 1 });
        }
        const itemConfig = getItem(itemId);
        result.items.push(itemConfig?.name || itemId);
      }
    }
    if (user.canLevelUp()) user.levelUp();
    await user.save();
  }

  // 清理状态
  const state = getPlayerInstance(userId);
  delete state[dungeonId];

  return { success: true, dungeon: dungeon.name, rewards: result };
}

// 退出副本（未完成）
async function leaveDungeon(userId, dungeonId) {
  const state = getPlayerInstance(userId);
  if (state[dungeonId]) delete state[dungeonId];
  return { success: true, message: '已退出副本' };
}

// 检查副本限时是否到期
function checkTimeLimit(userId, dungeonId) {
  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return false;
  const dungeon = getDungeon(dungeonId);
  if (!dungeon?.timeLimitMinutes) return false;
  if (!state[dungeonId].startTime) return false;
  const elapsed = (Date.now() - state[dungeonId].startTime) / 60000;
  return elapsed > dungeon.timeLimitMinutes;
}

// 获取探索副本状态
function getExploreState(userId, dungeonId) {
  const state = getPlayerInstance(userId);
  return state[dungeonId] || null;
}

// 更新探索收集进度
async function updateExploreCollect(userId, dungeonId, itemId) {
  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return null;
  state[dungeonId].collected[itemId] = (state[dungeonId].collected[itemId] || 0) + 1;
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return null;
  const allDone = dungeon.collectTargets.every(t =>
    state[dungeonId].collected[t.itemId] >= t.count
  );
  return { collected: state[dungeonId].collected, complete: allDone };
}

module.exports = {
  getDungeon,
  getAllDungeons,
  enterDungeon,
  getNextWave,
  completeWave,
  completeDungeon,
  leaveDungeon,
  checkTimeLimit,
  getExploreState,
  updateExploreCollect,
  getDailyRuns,
  dungeons
};
