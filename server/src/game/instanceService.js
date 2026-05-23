const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { getItem } = require('./index');

const dungeons = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/dungeons.json'), 'utf-8'));

// 玩家副本状态 { userId: { dungeonId: { runsToday, currentWave, collected, startTime, ... } } }
const instanceStates = new Map();

// 藏经阁潜行状态 { battleId: { userId, dungeonId, layer, position, detections, collectedItems, cleared, startTime } }
const stealthStates = new Map();

// 鄱阳湖漂流状态 { battleId: { userId, dungeonId, mode, distance, banditsKilled, anchored, returned, itemsFound } }
const driftStates = new Map();

// 副本冷却追踪 { userId: { dungeonId: lastEndedAt } }
const dungeonCooldowns = new Map();

function getDungeonCooldown(userId, dungeonId) {
  const userCooldowns = dungeonCooldowns.get(userId);
  if (!userCooldowns || !userCooldowns[dungeonId]) return null;
  return userCooldowns[dungeonId];
}

function setDungeonCooldown(userId, dungeonId) {
  if (!dungeonCooldowns.has(userId)) dungeonCooldowns.set(userId, {});
  dungeonCooldowns.get(userId)[dungeonId] = Date.now();
}

function checkCooldown(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon?.cdMinutes) return null; // no CD configured
  const lastEnded = getDungeonCooldown(userId, dungeonId);
  if (!lastEnded) return null; // never ran before
  const elapsed = (Date.now() - lastEnded) / 60000; // in minutes
  if (elapsed < dungeon.cdMinutes) {
    const remaining = Math.ceil(dungeon.cdMinutes - elapsed);
    return { onCooldown: true, remainingMinutes: remaining, cdMinutes: dungeon.cdMinutes };
  }
  return null; // CD expired
}

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

  // 检查CD
  const cdCheck = checkCooldown(userId, dungeonId);
  if (cdCheck?.onCooldown) {
    return { error: `副本冷却中，还需等待 ${cdCheck.remainingMinutes} 分钟` };
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

  // 设置冷却
  setDungeonCooldown(userId, dungeonId);

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

// ==================== 万安塔 (tower) ====================

// 获取塔层信息
function getTowerFloor(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon || dungeon.type !== 'tower') return { error: '非爬塔副本' };

  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return { error: '尚未进入副本' };

  const currentFloor = state[dungeonId].currentFloor || 0;
  const nextFloor = currentFloor + 1;

  // 检查是否已通关
  if (nextFloor > dungeon.totalFloors) {
    return { complete: true, message: '已登顶万安塔！' };
  }

  // 检查是否已退出
  if (state[dungeonId].exitedEarly) {
    return { exited: true, message: '已敲锣退出' };
  }

  const floorConfig = dungeon.floors[nextFloor - 1];
  const reward = {
    exp: floorConfig.expReward,
    pot: floorConfig.potReward,
    renown: floorConfig.renownReward,
    accumulatedExp: dungeon.floors.slice(0, nextFloor).reduce((s, f) => s + f.expReward, 0),
    accumulatedPot: dungeon.floors.slice(0, nextFloor).reduce((s, f) => s + f.potReward, 0)
  };

  return {
    floor: nextFloor,
    totalFloors: dungeon.totalFloors,
    description: floorConfig.description,
    monsters: [{ monsterId: floorConfig.monsterId, count: floorConfig.count }],
    currentReward: reward,
    cdMinutes: dungeon.cdMinutes || 15
  };
}

// 完成一层塔
async function completeTowerFloor(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon || dungeon.type !== 'tower') return { error: '非爬塔副本' };

  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return { error: '尚未进入副本' };

  const currentFloor = (state[dungeonId].currentFloor || 0) + 1;
  state[dungeonId].currentFloor = currentFloor;

  if (currentFloor >= dungeon.totalFloors) {
    // 通关
    const user = await User.findById(userId);
    if (user) {
      const rewards = dungeon.rewards;
      if (rewards.exp) user.exp += rewards.exp;
      if (rewards.gold) user.gold += rewards.gold;
      if (user.canLevelUp()) user.levelUp();
      await user.save();
    }
    delete state[dungeonId];
    setDungeonCooldown(userId, dungeonId);
    return { complete: true, floor: currentFloor, message: '恭喜登顶万安塔！获得塔顶秘宝。' };
  }

  return {
    complete: false,
    floor: currentFloor,
    nextFloor: currentFloor + 1,
    message: `通过第${currentFloor}层！可以敲锣领取当前奖励，或继续攀登。`
  };
}

// 敲锣退出（领取当前累积奖励）
async function exitTower(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon || dungeon.type !== 'tower') return { error: '非爬塔副本' };

  const state = getPlayerInstance(userId);
  if (!state[dungeonId]) return { error: '尚未进入副本' };

  const currentFloor = state[dungeonId].currentFloor || 0;
  if (currentFloor === 0) {
    delete state[dungeonId];
    return { message: '还未开始攀登，直接退出。' };
  }

  state[dungeonId].exitedEarly = true;

  // 计算累积奖励
  let totalExp = 0, totalPot = 0, totalRenown = 0;
  for (let i = 0; i < currentFloor; i++) {
    totalExp += dungeon.floors[i].expReward;
    totalPot += dungeon.floors[i].potReward;
    totalRenown += dungeon.floors[i].renownReward;
  }

  const user = await User.findById(userId);
  if (user) {
    user.exp = (user.exp || 0) + totalExp;
    user.gold = (user.gold || 0) + totalPot;
    if (user.canLevelUp()) user.levelUp();
    await user.save();
  }

  delete state[dungeonId];
  setDungeonCooldown(userId, dungeonId);
  return {
    floor: currentFloor,
    rewards: { exp: totalExp, gold: totalPot, renown: totalRenown },
    message: `敲锣收功！获得第1-${currentFloor}层累积奖励：经验+${totalExp}，潜能+${totalPot}。`
  };
}

// ==================== 藏经阁 (stealth) ====================

function getOrCreateBattleId() {
  return 'stealth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// 开始藏经阁潜行
function startStealth(userId, dungeonId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon || dungeon.type !== 'stealth') return { error: '非潜行副本' };

  const battleId = getOrCreateBattleId();
  const layer1 = dungeon.mazeLayers[0];

  stealthStates.set(battleId, {
    userId,
    dungeonId,
    layer: 1,
    position: 0,
    detections: 0,
    maxDetections: dungeon.maxDetections || 3,
    collectedItems: [],
    cleared: false,
    startTime: Date.now(),
    score: 0
  });

  return {
    battleId,
    layer: { number: 1, type: layer1.type, description: layer1.description, rooms: layer1.rooms },
    patrolCount: layer1.patrolCount,
    treasureCount: layer1.treasureCount,
    maxDetections: dungeon.maxDetections,
    message: '进入藏经阁第一层。小心避开巡逻僧兵！'
  };
}

// 潜行移动
function moveStealth(battleId) {
  const state = stealthStates.get(battleId);
  if (!state) return { error: '潜行状态不存在' };

  const dungeon = getDungeon(state.dungeonId);
  if (!dungeon) return { error: '副本不存在' };

  const layerConfig = dungeon.mazeLayers[state.layer - 1];
  const maxRooms = layerConfig.rooms;

  // 前进
  state.position += 1;

  // 遭遇检查
  const encounter = { type: 'move', position: state.position, maxRooms };

  // 巡逻遭遇 (每前进3-5步有概率触发)
  if (state.position % Math.floor(Math.random() * 3 + 3) === 0) {
    if (Math.random() < 0.3) {
      state.detections += 1;
      encounter.type = 'detected';
      encounter.detections = state.detections;
      encounter.maxDetections = state.maxDetections;
      encounter.message = `被巡逻僧兵发现！剩余看破次数：${state.maxDetections - state.detections}`;
    }
  }

  // 宝物收集 (概率触发)
  if (Math.random() < 0.15 && state.collectedItems.length < layerConfig.treasureCount) {
    encounter.type = 'found_item';
    encounter.item = { id: 'item_ancient_jade', name: '古玉残片' };
    state.collectedItems.push('item_ancient_jade');
    state.score += 100;
    encounter.message = '发现散落的武学残页/古玉！积分+100';
  }

  // 到达终点
  if (state.position >= maxRooms) {
    state.cleared = true;
    encounter.type = 'layer_complete';
    encounter.message = `通过第${state.layer}层！`;

    if (state.layer < dungeon.mazeLayers.length) {
      state.layer += 1;
      state.position = 0;
      state.collectedItems = [];
      const nextLayer = dungeon.mazeLayers[state.layer - 1];
      encounter.nextLayer = { number: state.layer, type: nextLayer.type, description: nextLayer.description, rooms: nextLayer.rooms };
    } else {
      encounter.type = 'dungeon_complete';
      encounter.score = state.score;
      encounter.collected = state.collectedItems.length;
    }
  }

  // 被看破太多次 → 失败
  if (state.detections >= state.maxDetections) {
    encounter.type = 'failed';
    encounter.message = '看破次数耗尽，被巡逻僧兵擒获，押入戒律院！';
    stealthStates.delete(battleId);
  }

  if (encounter.type === 'dungeon_complete') {
    stealthStates.delete(battleId);
  }

  return encounter;
}

// 获取潜行状态
function getStealthState(battleId) {
  return stealthStates.get(battleId) || null;
}

// ==================== 鄱阳湖漂流 (drift) ====================

// 开始漂流
function startDrift(userId, dungeonId, modeId) {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon || dungeon.type !== 'drift') return { error: '非漂流副本' };

  const mode = dungeon.modes.find(m => m.id === modeId);
  if (!mode) return { error: '无效的漂流模式' };

  const battleId = 'drift_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  driftStates.set(battleId, {
    userId,
    dungeonId,
    mode: modeId,
    distance: 0,
    maxDistance: mode.maxDistance,
    banditsKilled: 0,
    anchored: false,
    returned: false,
    itemsFound: [],
    startTime: Date.now()
  });

  return {
    battleId,
    mode: { id: mode.id, name: mode.name, description: mode.description },
    maxDistance: mode.maxDistance,
    hasGems: mode.hasGems,
    shipCommands: dungeon.shipCommands,
    message: `登上小船，选择「${mode.name}」模式。扬帆起航！`
  };
}

// 获取漂流状态
function getDriftState(battleId) {
  return driftStates.get(battleId) || null;
}

// 船控命令
function shipNavigate(battleId, command) {
  const state = driftStates.get(battleId);
  if (!state) return { error: '漂流状态不存在' };

  const dungeon = getDungeon(state.dungeonId);
  if (!dungeon) return { error: '副本不存在' };

  const result = { command, distance: state.distance, maxDistance: state.maxDistance };

  switch (command) {
    case 'shengfan': // 升帆加速
      if (state.anchored) return { ...result, message: '已下锚，无法升帆。先起锚再行船。' };
      state.distance += Math.floor(Math.random() * 3 + 2);
      result.message = '升起船帆，乘风破浪！';
      break;

    case 'jiangfan': // 降帆减速
      if (state.anchored) return { ...result, message: '已下锚，无需降帆。' };
      state.distance += 1;
      result.message = '降下船帆，缓缓前行。';
      break;

    case 'huadong': // 划桨
      if (state.anchored) {
        // 起锚
        state.anchored = false;
        result.message = '收起锚链，用力划桨！';
      } else {
        state.distance += 1;
        result.message = '奋力划桨，小船向前。';
      }
      break;

    case 'tingchuan': // 停船
      state.distance += 0;
      result.message = '停船观望，水面波光粼粼。';
      break;

    case 'xiamao': // 下锚寻宝
      if (state.anchored) return { ...result, message: '已经下锚了。' };
      state.anchored = true;
      result.anchored = true;
      result.message = '抛下铁锚，开始搜寻水下宝藏...';
      // 概率寻得宝物
      const foundItems = [];
      if (Math.random() < 0.4) foundItems.push('item_jade_piece');
      if (Math.random() < 0.2) foundItems.push('item_ice_crystal');
      if (state.mode === 'heavy' && Math.random() < 0.1) foundItems.push('item_jiao_dan');
      result.foundItems = foundItems;
      state.itemsFound.push(...foundItems);
      if (foundItems.length > 0) {
        result.message += ` 寻得${foundItems.length}件宝物！`;
      } else {
        result.message += ' 此处没有发现宝物。';
      }
      break;

    case 'fanhang': // 返航
      if (!state.anchored) return { ...result, message: '请先下锚停船再返航。' };
      state.returned = true;
      result.returned = true;
      result.totalItems = state.itemsFound.length;
      result.banditsKilled = state.banditsKilled;
      result.message = '收起锚链，转舵返航！漂流结束，驶回码头。';
      driftStates.delete(battleId);
      break;

    case 'xiufu': // 修复
      result.message = '修补船身裂缝，小船恢复稳固。';
      break;

    case 'tancha': // 探查
      result.message = `当前航程：${state.distance}/${state.maxDistance}里。${state.anchored ? '已下锚。' : '航行中。'}`;
      break;

    default:
      return { error: `未知船控指令：${command}。可用：升帆/降帆/划动/停船/下锚/返航/修复/探查` };
  }

  // 检查是否超过最大距离
  if (state.distance > state.maxDistance) {
    state.distance = state.maxDistance;
    result.message += ' 已到达湖区最深处！';
  }

  // 水贼遭遇
  if (!state.anchored && state.distance > 0 && Math.random() < 0.25) {
    const bandits = dungeon.waterBandits;
    for (const band of bandits) {
      if (state.distance >= band.minDistance && state.distance <= band.maxDistance) {
        result.encounter = {
          type: 'bandit',
          monsterId: band.monsterId,
          count: band.count,
          isHead: Math.random() < band.headChance,
          message: '水面翻涌！水贼从水下窜出，拦住去路！'
        };
        break;
      }
    }
  }

  result.distance = state.distance;
  return result;
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
  dungeons,
  // Tower
  getTowerFloor,
  completeTowerFloor,
  exitTower,
  // Stealth
  startStealth,
  moveStealth,
  getStealthState,
  // Drift
  startDrift,
  getDriftState,
  shipNavigate,
  // CD
  checkCooldown,
  getDungeonCooldown,
  setDungeonCooldown
};
