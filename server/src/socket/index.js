const { User, CharacterSkill, Inventory, Quest, ChatMessage, BattleLog, Achievement, Gang } = require('../models');
const { socketAuthMiddleware, registerSocket: authRegisterSocket, unregisterSocket: authUnregisterSocket, findSocketByUserId: authFindSocket } = require('../middleware/auth');
const { getRoom, getNpc, getRoomExits, getNpcsInRoom, getMonstersInRoom, getSkill, getQuest, getItem, getItemByName, getFaction, getAllFactions, getLearnableSkills, getForgeRecipe, getAllForgeRecipes, getFactionQuest, getFactionQuestsByFaction } = require('../game');
const BattleService = require('../game/battleService');
const questProgressService = require('../game/questProgressService');
const roomDropsService = require('../game/roomDropsService');
const tradeService = require('../game/tradeService');
const achievementService = require('../game/achievementService');
const weatherTimeService = require('../game/weatherTimeService');
const craftService = require('../game/craftService');
const dailyService = require('../game/dailyService');
const auctionService = require('../game/auctionService');
const instanceService = require('../game/instanceService');

// P6: 副本战斗上下文 { battleId: { type:'tower'|'stealth'|'drift', dungeonId, ... } }
const dungeonBattleContexts = new Map();
const gangService = require('../game/gangService');
const actionLogService = require('../game/actionLogService');
const { checkSocketRate } = require('../middleware/rateLimiter');
const { validateEvent } = require('../game/validatorService');
const antiCheatService = require('../game/antiCheatService');

// 服务名称映射
const SERVICE_LABELS = {
  rest: '休息', rumor: '打听消息', shop: '商店', buy_item: '购买', buy_weapon: '买武器',
  sell_item: '出售', repair: '修理', train: '训练', learn_skill: '学习技能',
  meditate: '冥想', water: '饮水', pvp: '竞技', quest: '任务', ranking: '排行榜',
  bank: '钱庄', storage: '仓库', guide: '向导', exchange: '贡献兑换', travel: '出行',
  fortune: '算命', forge_weapon: '锻造', drink: '饮酒'
};

// 方向中文映射
const PVP_DISCONNECT_GRACE_SECONDS = 30;
const DIR_LABELS = {
  north: '北', south: '南', east: '东', west: '西',
  up: '上', down: '下', in: '进', out: '出', back: '返回',
  north_east: '东北', north_west: '西北', south_east: '东南', south_west: '西南',
  temple: '寺院', cave: '洞穴', forge: '锻造', ship: '船上', sail: '航行',
  cabin: '船舱', deck: '甲板', shore: '岸边'
};

// 在线玩家映射
const onlinePlayers = new Map();

// 房间内玩家映射
const roomPlayers = new Map();

// PVP挑战超时管理
const pvpChallenges = new Map();

// 商店库存（roomId -> { itemId: stock }），每10分钟自动重置
const shopStocks = new Map();
function getShopStock(roomId, itemId) {
  if (!shopStocks.has(roomId)) shopStocks.set(roomId, {});
  const stock = shopStocks.get(roomId);
  if (!(itemId in stock)) {
    // 默认库存：价格越低越多
    const item = getItem(itemId);
    const price = item?.price || 100;
    stock[itemId] = price <= 10 ? 20 : price <= 100 ? 10 : price <= 500 ? 5 : 2;
  }
  return stock[itemId];
}
// 原子库存扣减：检查库存足够才扣减，返回是否成功
function tryDecrShopStock(roomId, itemId, qty) {
  const s = shopStocks.get(roomId);
  if (!s) return false;
  if (s[itemId] == null) {
    getShopStock(roomId, itemId); // 初始化默认库存
  }
  if (s[itemId] < qty) return false;
  s[itemId] -= qty;
  return true;
}
// 每10分钟重置库存
setInterval(() => shopStocks.clear(), 600000);

let socketServer = null;

// 统一的Socket事件守卫：限频 → 输入验证 → 反作弊记录
function guardSocket(socket, user, eventName, data) {
  // 1. 频率检查
  const rateCheck = checkSocketRate(user._id, eventName);
  if (!rateCheck.allowed) {
    if (rateCheck.penalty === 'kick') {
      socket.emit('error', { message: '操作过于频繁，连接已断开' });
      socket.disconnect(true);
    } else if (rateCheck.penalty === 'mute') {
      socket.emit('system_message', { content: '⚠️ 操作过于频繁，你已被暂时禁言' });
    }
    return false;
  }

  // 2. 禁言检查
  if (antiCheatService.isMuted(user._id)) {
    const muteEvents = ['chat_world', 'chat_room', 'chat_private', 'chat_gang', 'trade_request', 'trade_add_item', 'auction_create'];
    if (muteEvents.includes(eventName)) {
      socket.emit('system_message', { content: '⚠️ 你已被禁言，无法进行此操作' });
      return false;
    }
  }

  // 3. 输入验证
  const validationError = validateEvent(eventName, data);
  if (validationError) {
    actionLogService.log(user._id, user.characterName, 'system', 'invalid_input', { event: eventName, error: validationError });
    socket.emit('error', { message: validationError });
    return false;
  }

  // 4. 反作弊记录
  if (!['look', 'who', 'help', 'get_time', 'list_factions', 'list_learnable_skills', 'list_faction_quests', 'list_gathering_nodes', 'list_alchemy_recipes', 'list_cooking_recipes', 'get_forge_recipes', 'get_achievements', 'get_daily_status', 'shop_list', 'get_battle_logs', 'get_battle_detail', 'auction_search', 'auction_my_listings', 'list_dungeons', 'gang_search', 'gang_info'].includes(eventName)) {
    antiCheatService.recordAction(user._id, eventName);
  }

  return true;
}

function socketHandler(io) {
  socketServer = io;

  // 认证中间件
  io.use(socketAuthMiddleware);
  
  // 创建战斗服务
  const battleService = new BattleService(io);

  // 启动战斗过期清理定时器
  battleService.startCleanupTimer();

  // 服务器启动时：重置所有残留的战斗状态
  (async function recoverFightingStatus() {
    try {
      const result = await User.updateMany(
        { status: 'fighting' },
        { $set: { status: 'online' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Battle] 启动恢复：重置了 ${result.modifiedCount} 个卡在战斗中的玩家状态`);
      }
    } catch (err) {
      console.error('[Battle] 启动恢复失败:', err.message);
    }
  })();

  // 初始化任务进度服务
  questProgressService.init(io);

  // 随机宝箱刷新（每3分钟在随机房间投放物品）
  const CHEST_ROOMS = ['village_center', 'village_field', 'village_inn', 'forest_entrance', 'forest_path', 'deep_forest', 'river_bank', 'bamboo_grove', 'snow_field', 'market_street'];
  const CHEST_ITEMS = ['item_hp_pill', 'item_mp_pill', 'item_hp_pill_medium', 'item_mp_pill_medium', 'item_bandage', 'item_rabbit_meat', 'item_rabbit_fur', 'item_iron_ore', 'item_herb', 'item_mushroom', 'item_ginseng', 'item_fish', 'item_antidote', 'item_strength_pill'];
  setInterval(() => {
    try {
      const roomId = CHEST_ROOMS[Math.floor(Math.random() * CHEST_ROOMS.length)];
      const itemId = CHEST_ITEMS[Math.floor(Math.random() * CHEST_ITEMS.length)];
      const itemConfig = getItem(itemId);
      if (itemConfig && roomDropsService.getDrops(roomId).length < 5) {
        roomDropsService.addDrop(roomId, itemId, itemConfig.name, 1, '神秘宝箱');
        io.to(`room:${roomId}`).emit('system_message', { content: '📦 一个神秘宝箱出现在附近...' });
        io.to(`room:${roomId}`).emit('room_drops_updated', { drops: roomDropsService.getDrops(roomId) });
      }
    } catch (e) { /* ignore spawn errors */ }
  }, 180000);
  
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[Socket] 用户连接: ${user.characterName} (${socket.id})`);

    // 全局包装 socket.on，自动注入限频+校验+反作弊
    const _on = socket.on.bind(socket);
    const readOnlyEvents = new Set(['look', 'who', 'help', 'get_time', 'list_factions', 'list_learnable_skills',
      'list_faction_quests', 'list_gathering_nodes', 'list_alchemy_recipes', 'list_cooking_recipes',
      'get_forge_recipes', 'get_achievements', 'get_daily_status', 'shop_list', 'get_battle_logs',
      'get_battle_detail', 'auction_search', 'auction_my_listings', 'list_dungeons', 'gang_search', 'gang_info']);
    socket.on = (eventName, handler) => {
      _on(eventName, async (data) => {
        if (!readOnlyEvents.has(eventName)) {
          if (!guardSocket(socket, user, eventName, data)) return;
        }
        try {
          await handler(data);
        } catch (err) {
          console.error(`[Socket] ${eventName} error:`, err.message);
          socket.emit('error', { message: '服务器内部错误' });
        }
      });
    };
    
    // 加入在线列表 + 单设备登录
    onlinePlayers.set(socket.id, {
      userId: user._id,
      name: user.characterName,
      level: user.level,
      location: user.location,
      faction: user.faction,
      socketId: socket.id
    });
    authRegisterSocket(user._id, socket.id);
    
    // 加入房间频道
    const roomId = user.location.roomId;
    socket.join(`room:${roomId}`);
    addToRoom(roomId, socket.id, user);
    
    // 更新用户状态
    user.status = 'online';
    await user.save();
    
    // 发送欢迎消息（含动态引导提示）
    const questCount = await Quest.countDocuments({ userId: user._id });
    let tip = null;
    if (user.level <= 1 && !questCount) {
      tip = '💡 新手: 输入 talk npc_village_chief 与村长对话，接取第一个任务';
    } else if (!user.faction && user.level >= 5) {
      tip = '💡 提示: 你还没有加入门派，输入 factions 查看门派列表，找到对应的NPC拜师学艺';
    } else if (user.freePoints > 0) {
      tip = `💡 提示: 你有 ${user.freePoints} 点可分配属性，点击左侧面板属性旁的 + 号来提升实力`;
    } else if (questCount > 0) {
      const activeQuests = await Quest.countDocuments({ userId: user._id, status: { $in: ['accepted', 'in_progress'] } });
      const completedQuests = await Quest.countDocuments({ userId: user._id, status: 'completed', rewardClaimed: false });
      if (completedQuests > 0) {
        tip = `💡 提示: 你有 ${completedQuests} 个任务已完成，在任务面板点击"领取奖励"或找到对应NPC交任务`;
      } else if (activeQuests > 0) {
        tip = '💡 提示: 使用 quests 查看任务进度，输入 help 查看所有命令';
      }
    }
    socket.emit('welcome', {
      message: `欢迎来到侠客行，${user.characterName}！`,
      tip,
      player: {
        name: user.characterName,
        level: user.level,
        hp: user.hp,
        mp: user.mp,
        gold: user.gold,
        location: user.location,
        attributes: user.attributes,
        freePoints: user.freePoints
      },
      room: getRoomDescription(roomId)
    });
    
    // 广播玩家进入房间
    io.to(`room:${roomId}`).emit('player_entered', {
      name: user.characterName,
      level: user.level
    });
    
    // 自然恢复定时器 - 每60秒恢复少量HP/MP
    const naturalRegenInterval = setInterval(async () => {
      try {
        // 重新读取用户数据
        const freshUser = await User.findById(user._id);
        if (!freshUser || freshUser.status === 'dead' || freshUser.status === 'battling') return;
        
        let changed = false;
        const hpRegen = Math.max(1, Math.floor(freshUser.hp.max * 0.02)); // 每分钟恢复2% HP
        const mpRegen = Math.max(1, Math.floor(freshUser.mp.max * 0.03)); // 每分钟恢复3% MP
        
        if (freshUser.hp.current < freshUser.hp.max) {
          freshUser.hp.current = Math.min(freshUser.hp.current + hpRegen, freshUser.hp.max);
          changed = true;
        }
        if (freshUser.mp.current < freshUser.mp.max) {
          freshUser.mp.current = Math.min(freshUser.mp.current + mpRegen, freshUser.mp.max);
          changed = true;
        }
        
        if (changed) {
          await freshUser.save();
          socket.emit('natural_regen', {
            hp: freshUser.hp,
            mp: freshUser.mp
          });
        }
      } catch (err) {
        // 静默失败，不影响游戏
      }
    }, 60000); // 每60秒

    // ========== PvP掉线重连恢复 ==========
    // 检查是否有该玩家的掉线保护，有则恢复战斗
    (async function checkDisconnectRecovery() {
      for (const [battleId, protection] of battleService.disconnectProtection) {
        if (protection.userId === user._id.toString()) {
          const battle = battleService.getBattle(battleId);
          if (battle && battle.status === 'active') {
            // 取消掉线保护
            battleService.cancelDisconnectProtection(battleId);
            // 恢复玩家状态
            user.status = 'fighting';
            await user.save();
            // 重新加入战斗房间
            const battleRoom = `battle:${battleId}`;
            socket.join(battleRoom);
            socket.emit('battle_reconnected', { battleId, battle: {
              battleId: battle.battleId,
              type: battle.type,
              currentRound: battle.currentRound,
              status: battle.status,
              participants: battle.participants.map(p => ({
                name: p.name,
                hp: p.hp,
                maxHp: p.maxHp,
                mp: p.mp,
                maxMp: p.maxMp,
                statusEffects: p.statusSummary || [],
                isMonster: p.isMonster || false
              })),
              turnOrder: battle.turnOrder.map(p => p.name)
            }});
            // 通知对手
            io.to(battleRoom).emit('system_message', {
              content: `✅ ${user.characterName} 已重新连接，战斗继续`
            });
            console.log(`[Battle] PvP重连: ${user.characterName} → ${battleId}`);
          } else {
            // 战斗已结束，清理保护
            battleService.cancelDisconnectProtection(battleId);
          }
          return;
        }
      }
    })();

    // ==================== 房间相关 ====================
    
    // 查看房间
    socket.on('look', async () => {
      const roomId = user.location.roomId;
      const roomDesc = getRoomDescription(roomId);
      roomDesc.drops = roomDropsService.getDrops(roomId);
      socket.emit('room_info', roomDesc);
    });

    // 帮助
    socket.on('help', () => {
      const room = getRoom(user.location.roomId);
      const services = room?.services || [];
      const helpLines = [
        '══════════════════════════════',
        '【移动】n/s/e/w | north/south/east/west | go <方向> | look/l',
        '【战斗】kill/attack <怪物ID> | skill <技能名> | flee',
        '【物品】inv/i | pickup <物品> | use <物品> | equip <物品> | unequip <槽位>',
        '【商店】shop | buy <物品> | sell <物品>',
      ];
      if (services.includes('rest')) {
        helpLines.push('【休息】rest - 客栈可完全恢复HP/MP');
      } else {
        helpLines.push('【休息】rest - 任何地方都可休息（客栈完全恢复，野外50%）');
      }
      helpLines.push('【任务】quests | talk <NPC_ID> | 在任务面板领取奖励');
      helpLines.push('【社交】who | say <内容> | trade <玩家> | pvp <玩家>');
      helpLines.push('【门派】factions | faction join <门派ID> | faction leave');
      helpLines.push('【系统】help | rumor | where | time');
      if (user.freePoints > 0) {
        helpLines.push(`💡 你有 ${user.freePoints} 可分配属性点，点击左侧属性旁的 + 分配`);
      }
      helpLines.push('══════════════════════════════');
      for (const line of helpLines) {
        socket.emit('system_message', { content: line });
      }
    });
    
    // 移动
    socket.on('move', async (data) => {
      const { direction } = data;

      // 战斗中不能移动
      if (user.status === 'fighting') {
        return socket.emit('error', { message: '战斗中无法移动，请先逃跑' });
      }

      const currentRoom = getRoom(user.location.roomId);

      if (!currentRoom) {
        return socket.emit('error', { message: '当前位置无效' });
      }
      
      const exit = currentRoom.exits?.find(e => e.direction === direction);
      if (!exit) {
        return socket.emit('error', { message: '该方向没有出口' });
      }
      
      const oldRoomId = user.location.roomId;
      // 离开当前房间
      socket.leave(`room:${oldRoomId}`);
      removeFromRoom(oldRoomId, socket.id);
      io.to(`room:${oldRoomId}`).emit('player_left', {
        name: user.characterName
      });
      // 通知旧房间剩余玩家刷新房间信息
      io.to(`room:${oldRoomId}`).emit('room_info', getRoomDescription(oldRoomId));
      
      // 进入新房间
      user.location.roomId = exit.roomId;
      await user.save();
      
      socket.join(`room:${exit.roomId}`);
      addToRoom(exit.roomId, socket.id, user);
      
      io.to(`room:${exit.roomId}`).emit('player_entered', {
        name: user.characterName,
        level: user.level
      });
      // 通知新房间所有玩家刷新房间信息
      io.to(`room:${exit.roomId}`).emit('room_info', getRoomDescription(exit.roomId));

      socket.emit('room_info', getRoomDescription(exit.roomId));

      // 通知新房间地面掉落
      const newRoomDrops = roomDropsService.getDrops(exit.roomId);
      if (newRoomDrops.length > 0) {
        socket.emit('room_drops', { drops: newRoomDrops, roomId: exit.roomId });
      }

      // 任务进度：到达房间
      questProgressService.checkProgress(user._id, { type: 'visit', target: exit.roomId }).catch(() => {});
      // 每日任务：移动
      dailyService.updateDailyTaskProgress(user._id, 'move').catch(() => {});
      actionLogService.log(user._id, user.characterName, 'movement', 'move', { from: currentRoom?.id, to: exit.roomId }, exit.roomId);

      // 新房间记录
      if (!user.stats) user.stats = {};
      if (!user.stats.roomsVisited) user.stats.roomsVisited = [];
      if (!user.stats.roomsVisited.includes(exit.roomId)) {
        user.stats.roomsVisited.push(exit.roomId);
        await user.save();
        checkAndAwardAchievements(user._id);
      }    });
    
    // ==================== 战斗相关 ====================

    // P6: 副本战斗结束处理
    async function handleDungeonBattleEnd(battle, result) {
      const ctx = dungeonBattleContexts.get(battle.battleId);
      if (!ctx) return false;
      dungeonBattleContexts.delete(battle.battleId);

      const isWin = result.battle?.winner?.userId && 
        result.battle.winner.userId.toString() === user._id.toString();

      if (ctx.type === 'tower') {
        if (isWin) {
          // 胜利 → 推进楼层
          const floorResult = await instanceService.completeTowerFloor(user._id, ctx.dungeonId);
          if (floorResult.error) {
            socket.emit('error', { message: floorResult.error });
          } else if (floorResult.complete) {
            socket.emit('tower_completed', floorResult);
            socket.emit('system_message', { content: floorResult.message });
          } else {
            socket.emit('tower_floor_cleared', floorResult);
            socket.emit('system_message', { content: floorResult.message });
            // 自动请求下一层信息
            setTimeout(() => {
              const nextFloor = instanceService.getTowerFloor(user._id, ctx.dungeonId);
              if (!nextFloor.error) socket.emit('tower_floor', nextFloor);
            }, 300);
          }
        } else {
          // 失败 → 敲锣退出，领取已累积奖励
          const exitResult = await instanceService.exitTower(user._id, ctx.dungeonId);
          socket.emit('tower_exited', exitResult);
          socket.emit('system_message', { content: '战斗失败！敲锣收功，领取已累积的奖励。' });
        }
        return true;
      }

      if (ctx.type === 'stealth') {
        const stealthState = instanceService.getStealthState(ctx.battleId);
        if (stealthState) {
          if (!isWin) {
            stealthState.detections += 1;
            if (stealthState.detections >= stealthState.maxDetections) {
              socket.emit('stealth_failed', { message: '被巡逻僧兵击败，看破次数耗尽！' });
              socket.emit('system_message', { content: '被巡逻僧兵击败，押入戒律院！藏经阁探索失败。' });
            } else {
              socket.emit('stealth_detected', {
                detections: stealthState.detections,
                maxDetections: stealthState.maxDetections,
                message: `被巡逻僧兵击败！剩余看破次数：${stealthState.maxDetections - stealthState.detections}`
              });
              socket.emit('system_message', { content: `被巡逻僧兵击败！剩余看破次数：${stealthState.maxDetections - stealthState.detections}` });
            }
          }
          // If won, just continue — no special event needed
        }
        return true;
      }

      if (ctx.type === 'drift') {
        const driftState = instanceService.getDriftState(ctx.battleId);
        if (driftState) {
          if (isWin) {
            driftState.banditsKilled += 1;
            socket.emit('system_message', { content: '击败水贼！继续航行。' });
          } else {
            // Lost to bandits → drift failed early
            socket.emit('drift_completed', {
              distance: driftState.distance,
              totalItems: driftState.itemsFound.length,
              banditsKilled: driftState.banditsKilled,
              message: '被水贼击败！漂流到此结束，部分宝物丢失。'
            });
            socket.emit('system_message', { content: '被水贼击败！漂流提前结束。' });
          }
        }
        return true;
      }

      return false;
    }
    
    // 开始战斗
    socket.on('battle_start', async (data) => {
      const { targetId, type } = data;
      
      try {
        const battle = await battleService.startBattle(user._id, targetId, type || 'pve');
        const battleRoom = `battle:${battle.battleId}`;
        battle._roomName = battleRoom;  // 记录房间名，供超时清理使用
        socket.join(battleRoom);
        socket.emit('battle_started', battle);

        // 如果是PVP，通知对手
        if (type === 'pvp') {
          const opponentSocket = findSocketByUserId(targetId);
          if (opponentSocket) {
            opponentSocket.join(battleRoom);
            opponentSocket.emit('battle_started', battle);
          }
        }

        // 如果当前回合是怪物（怪物先手），自动处理怪物回合（上限MAX_AUTO_TURNS）
        let autoResult = { battle };
        let autoTurnCount = 0;
        while (autoResult.battle.status === 'active' && autoTurnCount < 10) {
          // PvP断线保护：掉线方回合自动防御
          if (type === 'pvp') {
            const dcAction = battleService.handleDisconnectedTurn(battle.battleId);
            if (dcAction?.autoAction) {
              const release = await battleService.acquireLock(battle.battleId);
              try {
                autoResult = await battleService.executeTurn(battle.battleId, dcAction.autoAction);
              } finally {
                battleService.releaseLock(battle.battleId, release);
              }
              io.to(battleRoom).emit('battle_update', autoResult);
              autoTurnCount++;
              continue;
            }
            if (dcAction?.battle?.status === 'ended') break;
          }

          const nextActor = battleService.getCurrentParticipant(battle.battleId);
          if (!nextActor?.isMonster) break;

          const monsterAction = battleService.chooseAutomatedAction(battle.battleId);
          const release = await battleService.acquireLock(battle.battleId);
          try {
            autoResult = await battleService.executeTurn(
              battle.battleId,
              monsterAction.action,
              monsterAction.skillId
            );
          } finally {
            battleService.releaseLock(battle.battleId, release);
          }
          io.to(battleRoom).emit('battle_update', autoResult);
          autoTurnCount++;
        }

        if (autoResult.battle.status === 'ended' || autoResult.battle.status === 'fled') {
          io.to(battleRoom).emit('battle_ended', autoResult);
          io.in(battleRoom).socketsLeave(battleRoom);

          // P6: 副本战斗上下文处理
          await handleDungeonBattleEnd(battle, autoResult);

          // 从DB同步最新用户状态
          const synced = await User.findById(user._id, 'status hp mp exp gold level freePoints stats').lean();
          if (synced) {
            user.status = synced.status;
            user.hp = synced.hp;
            user.mp = synced.mp;
            user.exp = synced.exp;
            user.gold = synced.gold;
            user.level = synced.level;
            user.freePoints = synced.freePoints;
            if (synced.stats) {
              user.stats = synced.stats;
            }
          }
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
    
    // 战斗行动
    socket.on('battle_action', async (data) => {
      const { battleId, action, skillId } = data;
      
      try {
        const roomName = `battle:${battleId}`;
        const battle = battleService.getBattle(battleId);
        if (!battle) {
          return socket.emit('error', { message: '战斗不存在' });
        }

        const currentActor = battle.turnOrder[battle.currentTurn];
        if (!currentActor?.userId || currentActor.userId.toString() !== user._id.toString()) {
          return socket.emit('error', { message: '还没轮到你行动' });
        }

        // 获取战斗锁（防止并发回合）
        const release = await battleService.acquireLock(battleId);
        let turnResult;
        try {
          turnResult = await battleService.executeTurn(battleId, action, skillId);
        } finally {
          battleService.releaseLock(battleId, release);
        }

        io.to(roomName).emit('battle_update', turnResult);

        // 自动处理怪物回合 + PvP掉线保护（上限10次）
        let autoCount = 0;
        while (turnResult.battle.status === 'active' && autoCount < 10) {
          // PvP断线保护
          if (battle.type === 'pvp') {
            const dcAction = battleService.handleDisconnectedTurn(battleId);
            if (dcAction?.autoAction) {
              const dcRelease = await battleService.acquireLock(battleId);
              try {
                turnResult = await battleService.executeTurn(battleId, dcAction.autoAction);
              } finally {
                battleService.releaseLock(battleId, dcRelease);
              }
              io.to(roomName).emit('battle_update', turnResult);
              autoCount++;
              continue;
            }
            if (dcAction?.battle?.status === 'ended') break;
          }

          const nextActor = battleService.getCurrentParticipant(battleId);
          if (!nextActor?.isMonster) {
            break;
          }

          const monsterAction = battleService.chooseAutomatedAction(battleId);
          const monRelease = await battleService.acquireLock(battleId);
          try {
            turnResult = await battleService.executeTurn(
              battleId,
              monsterAction.action,
              monsterAction.skillId
            );
          } finally {
            battleService.releaseLock(battleId, monRelease);
          }
          io.to(roomName).emit('battle_update', turnResult);
          autoCount++;
        }

        if (turnResult.battle.status === 'ended' || turnResult.battle.status === 'fled') {
          io.to(roomName).emit('battle_ended', turnResult);

          // P6: 副本战斗上下文处理
          await handleDungeonBattleEnd(battle, turnResult);

          // 从DB同步最新用户状态（endBattle已更新status/hp/mp/exp/gold）
          const synced = await User.findById(user._id, 'status hp mp exp gold level freePoints stats').lean();
          if (synced) {
            user.status = synced.status;
            user.hp = synced.hp;
            user.mp = synced.mp;
            user.exp = synced.exp;
            user.gold = synced.gold;
            user.level = synced.level;
            user.freePoints = synced.freePoints;
            if (synced.stats) {
              user.stats = synced.stats;
            }
          }

          // 任务进度：击杀怪物
          if (turnResult.battle.status === 'ended' && turnResult.battle.winner?.userId) {
            const monsterId = battle.monster?.id;
            if (monsterId) {
              questProgressService.checkProgress(user._id, { type: 'kill', target: monsterId }).catch(() => {});
            }
            // 更新统计并检查成就
            user.stats.battlesWon = (user.stats.battlesWon || 0) + 1;
            user.stats.goldEarned = (user.stats.goldEarned || 0) + (turnResult.rewards?.goldGained || 0);
            await user.save();
            checkAndAwardAchievements(user._id);
            dailyService.updateDailyTaskProgress(user._id, 'kill').catch(() => {});
            actionLogService.log(user._id, user.characterName, 'combat', 'kill', { monsterId: battle.monster?.id, exp: turnResult.rewards?.expGained, gold: turnResult.rewards?.goldGained }, user.location.roomId);
            dailyService.updateDailyTaskProgress(user._id, 'battle').catch(() => {});
          }

          // PVP 统计
          if (battle.type === 'pvp') {
            user.stats.pvpBattles = (user.stats.pvpBattles || 0) + 1;
            await user.save();
            checkAndAwardAchievements(user._id);
          }

          // 通知房间内玩家有新掉落
          if (turnResult.rewards?.itemsDropped?.length > 0) {
            const dropRoomId = turnResult.rewards.dropRoomId || user.location.roomId;
            const dropNames = turnResult.rewards.droppedItemNames || turnResult.rewards.itemsDropped;
            io.to(`room:${dropRoomId}`).emit('room_drops_updated', {
              drops: roomDropsService.getDrops(dropRoomId),
              message: `${user.characterName} 击败了 ${battle.monster?.name || '怪物'}，掉落了: ${dropNames.join(', ')}`
            });
          }

          io.in(roomName).socketsLeave(roomName);
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
    
    // 复活
    socket.on('revive', async () => {
      // 重新加载用户状态（战斗结束后可能已变更）
      const freshUser = await User.findById(user._id);
      if (!freshUser || freshUser.status !== 'dead') {
        return socket.emit('error', { message: '你还没有死亡' });
      }

      freshUser.revive();
      freshUser.stats = freshUser.stats || {};
      freshUser.stats.deaths = (freshUser.stats.deaths || 0) + 1;
      await freshUser.save();

      // 同步socket user引用
      user.status = freshUser.status;
      user.stats = freshUser.stats;
      user.hp = freshUser.hp;
      user.mp = freshUser.mp;
      user.location = freshUser.location;
      user.exp = freshUser.exp;
      user.gold = freshUser.gold;

      // 离开当前房间，加入复活点
      socket.leave(`room:${user.location.roomId}`);
      socket.join(`room:village_center`);

      socket.emit('revived', {
        hp: user.hp,
        mp: user.mp,
        location: user.location,
        message: '你已复活，回到了村庄中心。生命和内力恢复了30%。'
      });
      socket.emit('room_info', getRoomDescription('village_center'));
    });
    
    // ==================== 物品相关 ====================
    
    // 查看地面掉落物品
    socket.on('look_drops', async () => {
      const roomId = user.location.roomId;
      const drops = roomDropsService.getDrops(roomId);
      socket.emit('room_drops', { drops, roomId });
    });
    
    // 拾取地面物品
    socket.on('pickup_item', async (data) => {
      const { itemId, quantity = 1 } = data;
      const roomId = user.location.roomId;
      
      const pickedUp = roomDropsService.pickupItem(roomId, itemId, quantity);
      if (!pickedUp) {
        return socket.emit('error', { message: '该物品不在地面上' });
      }
      
      // 添加到背包
      let inventoryItem = await Inventory.findOne({ userId: user._id, itemId: pickedUp.itemId });
      if (inventoryItem) {
        inventoryItem.quantity += pickedUp.quantity;
        await inventoryItem.save();
      } else {
        await Inventory.create({
          userId: user._id,
          itemId: pickedUp.itemId,
          quantity: pickedUp.quantity,
          isEquipped: false
        });
      }
      
      socket.emit('item_picked_up', {
        itemId: pickedUp.itemId,
        name: pickedUp.name,
        quantity: pickedUp.quantity
      });
      socket.emit('system_message', {
        content: `你拾取了 ${pickedUp.name}×${pickedUp.quantity}`
      });
      
      // 通知房间内其他玩家
      io.to(`room:${roomId}`).emit('room_drops_updated', {
        drops: roomDropsService.getDrops(roomId)
      });
      
      // 任务进度：收集物品
      questProgressService.checkProgress(user._id, { type: 'collect', target: pickedUp.itemId }).catch(() => {});
    });

    // GM投放物品到当前房间
    socket.on('gm_drop_item', async (data) => {
      if (user.role !== 'gm' && user.role !== 'admin') {
        return socket.emit('error', { message: '权限不足' });
      }
      const { itemId, quantity = 1 } = data;
      const itemConfig = getItem(itemId);
      if (!itemConfig) {
        return socket.emit('error', { message: '物品不存在' });
      }
      const roomId = user.location.roomId;
      roomDropsService.addDrop(roomId, itemId, itemConfig.name, quantity, user.characterName);
      io.to(`room:${roomId}`).emit('room_drops_updated', {
        drops: roomDropsService.getDrops(roomId)
      });
      socket.emit('system_message', {
        content: `[GM] 在房间投放了 ${itemConfig.name}×${quantity}`
      });
      actionLogService.log(user._id, user.characterName, 'gm_action', 'drop_item',
        { itemId, itemName: itemConfig.name, quantity, roomId }, roomId);
    });
    
    // 使用物品
    socket.on('use_item', async (data) => {
      const { inventoryId, itemId, itemName } = data;

      // 支持三种查找方式：inventoryId、itemId、itemName
      let item;
      if (inventoryId) {
        item = await Inventory.findOne({ _id: inventoryId, userId: user._id, isEquipped: false });
      } else if (itemId || itemName) {
        const query = { userId: user._id, isEquipped: false };
        if (itemId) {
          query.itemId = itemId;
        } else if (itemName) {
          // 按名称模糊匹配
          const allItems = items();
          const matched = allItems.filter(i => i.name.includes(itemName) || i.id.includes(itemName));
          if (matched.length > 0) {
            query.itemId = { $in: matched.map(i => i.id) };
          } else {
            return socket.emit('error', { message: `未找到匹配「${itemName}」的物品` });
          }
        }
        // 取第一个匹配的非装备物品
        const items_ = await Inventory.find(query).sort({ isEquipped: 1 });
        if (items_.length > 0) {
          item = items_.find(i => !i.isEquipped) || items_[0];
        }
      }

      if (!item) {
        return socket.emit('error', { message: '物品不存在或已装备' });
      }
      
      const itemConfig = getItem(item.itemId);
      if (!itemConfig) {
        return socket.emit('error', { message: '物品配置不存在' });
      }
      
      // 根据物品类型处理
      if (itemConfig.type === 'consumable') {
        // 消耗品
        if (itemConfig.effects) {
          for (const effect of itemConfig.effects) {
            if (effect.type === 'heal_hp') {
              user.hp.current = Math.min(user.hp.current + effect.value, user.hp.max);
            } else if (effect.type === 'heal_mp') {
              user.mp.current = Math.min(user.mp.current + effect.value, user.mp.max);
            }
          }
        }
        
        item.quantity -= 1;
        if (item.quantity <= 0) {
          await Inventory.deleteOne({ _id: inventoryId });
        } else {
          await item.save();
        }
        
        await user.save();
        
        socket.emit('item_used', {
          item: itemConfig,
          hp: user.hp,
          mp: user.mp
        });
      } else if (itemConfig.type === 'skill_book') {
        // 功法书：概率学会技能
        const skillId = itemConfig.skillId;
        const skill = getSkill(skillId);
        if (!skill) {
          return socket.emit('error', { message: '此秘籍记载的功法已失传' });
        }

        if (user.skills.includes(skillId)) {
          return socket.emit('error', { message: `你已经学会了「${skill.name}」` });
        }

        if (skill.requireLevel && user.level < skill.requireLevel) {
          return socket.emit('error', { message: `等级不足，学习「${skill.name}」需要Lv${skill.requireLevel}` });
        }

        // 门派限制检查
        if (itemConfig.factionId || skill.factionId) {
          const requiredFaction = itemConfig.factionId || skill.factionId;
          if (requiredFaction !== 'general' && user.faction !== requiredFaction) {
            const factionConfig = getFaction(requiredFaction);
            return socket.emit('error', { message: `此功法书为${factionConfig?.name || requiredFaction}专属，你尚未加入该门派，无法领悟其中奥妙。` });
          }
        }

        // 门派等级限制检查
        if (itemConfig.requireFactionRank) {
          const rankOrder = { 'disciple': 0, 'deacon': 1, 'elder': 2, 'leader': 3 };
          const requiredRank = rankOrder[itemConfig.requireFactionRank] || 0;
          const currentRank = rankOrder[user.factionRank] || 0;
          if (currentRank < requiredRank) {
            const rankLabels = { 'disciple': '弟子', 'deacon': '执事', 'elder': '长老', 'leader': '掌门' };
            return socket.emit('error', { message: `此功法书需要门派等级达到${rankLabels[itemConfig.requireFactionRank] || itemConfig.requireFactionRank}才能领悟。` });
          }
        }

        // 概率判定
        const successRate = itemConfig.successRate || 0.5;
        const success = Math.random() < successRate;

        // 消耗秘籍
        item.quantity -= 1;
        if (item.quantity <= 0) {
          await Inventory.deleteOne({ _id: item._id });
        } else {
          await item.save();
        }

        if (success) {
          user.skills.push(skillId);
          await user.save();
          socket.emit('item_used', {
            item: itemConfig,
            success: true,
            skillLearned: skill.name,
            message: `✨ 研读《${itemConfig.name}》，灵光一闪，成功领悟了「${skill.name}」！`
          });
          actionLogService.log(user._id, user.characterName, 'skill', 'learn_from_book',
            { skillId, skillName: skill.name, bookName: itemConfig.name }, user.location.roomId);
          questProgressService.checkProgress(user._id, { type: 'learn_skill', target: skillId, skillRequireLevel: skill.requireLevel || 1 }).catch(() => {});
        } else {
          socket.emit('item_used', {
            item: itemConfig,
            success: false,
            message: `📖 研读《${itemConfig.name}》，但文字深奥，未能领悟……`
          });
        }
      } else if (isEquipmentItem(itemConfig)) {
        // 装备
        const equipSlot = getEquipmentSlot(itemConfig);
        if (!equipSlot) {
          return socket.emit('error', { message: '此物品暂时无法装备' });
        }

        if (!item.canEquip(user)) {
          return socket.emit('error', { message: '无法装备此物品' });
        }
        
        // 卸下同槽位装备
        const currentEquip = await Inventory.findOne({
          userId: user._id,
          equipSlot,
          isEquipped: true
        });
        
        if (currentEquip) {
          currentEquip.unequip();
          await currentEquip.save();
        }
        
        item.equip(equipSlot);
        await item.save();
        
        socket.emit('item_equipped', {
          item: itemConfig,
          slot: equipSlot
        });
      }
    });
    
    // ==================== 任务相关 ====================

    // 卸下装备
    socket.on('unequip_item', async (data) => {
      const { inventoryId } = data;
      const item = await Inventory.findOne({ _id: inventoryId, userId: user._id, isEquipped: true });
      if (!item) {
        return socket.emit('error', { message: '未找到已装备的物品' });
      }
      item.unequip();
      await item.save();
      socket.emit('item_unequipped', { itemId: item.itemId, slot: item.equipSlot });
    });
    
    // 接取任务
    socket.on('accept_quest', async (data) => {
      const { questId } = data;
      let questConfig = getQuest(questId);
      let isFactionQuest = false;

      // 如果不是普通任务，尝试查找门派任务
      if (!questConfig) {
        questConfig = getFactionQuest(questId);
        isFactionQuest = true;
      }

      if (!questConfig) {
        return socket.emit('error', { message: '任务不存在' });
      }

      // 门派任务：检查门派归属
      if (isFactionQuest) {
        if (!user.faction && questConfig.type !== 'faction_entry') {
          return socket.emit('error', { message: '你需要先加入门派才能接取此任务' });
        }
        if (user.faction && questConfig.factionId !== user.faction && questConfig.type !== 'faction_entry') {
          return socket.emit('error', { message: '此任务不属于你的门派' });
        }
        // 门派等级检查
        const rankOrder = ['disciple', 'deacon', 'elder', 'leader'];
        if (questConfig.minFactionRank) {
          const requiredRank = rankOrder.indexOf(questConfig.minFactionRank);
          const playerRank = rankOrder.indexOf(user.factionRank || 'disciple');
          if (playerRank < requiredRank) {
            return socket.emit('error', { message: `门派等级不足，需要 ${questConfig.minFactionRank}` });
          }
        }
      }
      
      // 检查是否已接取（重复任务检查冷却时间 / 每日重置）
      const existing = await Quest.findOne({ userId: user._id, questId });
      if (existing) {
        if (questConfig.dailyReset) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (existing.completedAt && existing.completedAt >= today) {
            return socket.emit('error', { message: '今日已完成此任务，明天再来吧' });
          }
          // 新的一天，删除旧记录
          await Quest.deleteOne({ _id: existing._id });
        } else if (questConfig.repeatable && questConfig.cooldown) {
          const cooldownMs = questConfig.cooldown * 1000;
          const lastCompleted = existing.completedAt;
          if (lastCompleted && Date.now() - lastCompleted.getTime() > cooldownMs) {
            // 冷却已过，删除旧记录允许重新接取
            await Quest.deleteOne({ _id: existing._id });
          } else if (lastCompleted) {
            const remaining = Math.ceil((cooldownMs - (Date.now() - lastCompleted.getTime())) / 1000 / 60);
            return socket.emit('error', { message: `任务冷却中，${remaining}分钟后可重新接取` });
          } else {
            return socket.emit('error', { message: '已接取此任务' });
          }
        } else {
          return socket.emit('error', { message: '已接取此任务' });
        }
      }
      
      // 检查前置任务
      if (questConfig.prerequisites) {
        const missingPrereqs = [];
        for (const prereq of questConfig.prerequisites) {
          const prereqQuest = await Quest.findOne({
            userId: user._id,
            questId: prereq,
            status: 'completed'
          });
          if (!prereqQuest) {
            const prereqConfig = getQuest(prereq);
            missingPrereqs.push(prereqConfig?.name || prereq);
          }
        }
        if (missingPrereqs.length > 0) {
          return socket.emit('error', { message: `需要先完成前置任务: ${missingPrereqs.join('、')}` });
        }
      }
      
      const newQuest = new Quest({
        userId: user._id,
        questId,
        status: 'accepted'
      });
      await newQuest.save();

      // 回溯检查：玩家可能已满足某些目标（如已在目标房间或刚与目标NPC对话）
      const backfillEvents = [];
      for (const obj of questConfig.objectives || []) {
        if (obj.type === 'visit') {
          const targetRoom = obj.roomId || obj.targetId;
          if (targetRoom && user.location.roomId === targetRoom) {
            backfillEvents.push({ type: 'visit', target: targetRoom });
          }
        } else if (obj.type === 'talk') {
          const targetNpcId = obj.npcId || obj.targetId;
          if (targetNpcId) {
            const room = getRoom(user.location.roomId);
            if (room) {
              const npcsInRoom = getNpcsInRoom(room.id);
              if (npcsInRoom.some(n => n.id === targetNpcId)) {
                backfillEvents.push({ type: 'talk', target: targetNpcId });
              }
            }
          }
        }
      }
      for (const event of backfillEvents) {
        await questProgressService.checkProgress(user._id, event);
      }

      socket.emit('quest_accepted', {
        quest: questConfig
      });
    });
    
    // 完成任务
    socket.on('complete_quest', async (data) => {
      const { questId } = data;
      
      const quest = await Quest.findOne({
        userId: user._id,
        questId,
        status: 'completed',
        rewardClaimed: false
      });
      
      if (!quest) {
        return socket.emit('error', { message: '任务未完成或已领取奖励' });
      }
      
      let questConfig = getQuest(questId);
      if (!questConfig) questConfig = getFactionQuest(questId);
      if (!questConfig) {
        return socket.emit('error', { message: '任务配置不存在' });
      }

      // 检查交接模式：npc模式需要找到对应NPC
      if (questConfig.completionMode === 'npc' && questConfig.handInNpcId) {
        const room = getRoom(user.location.roomId);
        const roomNpcs = getNpcsInRoom(room?.id);
        const handInNpc = roomNpcs.find(n => n.id === questConfig.handInNpcId);
        if (!handInNpc) {
          const npcName = getNpc(questConfig.handInNpcId)?.name || questConfig.handInNpcId;
          return socket.emit('error', { message: `你需要找到「${npcName}」交接任务才能领取奖励` });
        }
      }

      // 发放奖励
      const rewards = questConfig.rewards;
      if (rewards) {
        if (rewards.exp) user.exp += rewards.exp;
        if (rewards.gold) user.gold += rewards.gold;
        if (rewards.factionReputation) user.factionReputation += rewards.factionReputation;
        if (rewards.items) {
          for (const itemId of rewards.items) {
            const newItem = new Inventory({
              userId: user._id,
              itemId
            });
            await newItem.save();
          }
        }
        
        // 检查升级
        if (user.canLevelUp()) {
          user.levelUp();
        }
        
        await user.save();
      }
      
      quest.rewardClaimed = true;
      await quest.save();

      socket.emit('quest_completed', {
        quest: questConfig,
        rewards: questConfig.rewards
      });

      user.stats.questsCompleted = (user.stats.questsCompleted || 0) + 1;
      await user.save();
      checkAndAwardAchievements(user._id);
    });

    // ==================== 聊天相关 ====================
    
    // ==================== 战斗日志 ====================
    
    // 查询战斗历史
    // 查看在线玩家
    socket.on('who', async () => {
      const players = [];
      for (const [socketId, player] of onlinePlayers) {
        players.push({
          name: player.name,
          level: player.level,
          location: player.location,
          faction: player.faction
        });
      }
      socket.emit('online_players', { players, total: players.length });
    });
    
    socket.on('get_battle_logs', async (data = {}) => {
      const { limit = 10, offset = 0 } = data;
      
      const logs = await BattleLog.find({
        'participants.userId': user._id
      })
      .sort({ endedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
      
      const total = await BattleLog.countDocuments({
        'participants.userId': user._id
      });
      
      socket.emit('battle_logs', { logs, total, offset, limit });
    });
    
    // 查询单场战斗详情
    socket.on('get_battle_detail', async (data) => {
      const { battleId } = data;
      
      const log = await BattleLog.findOne({
        battleId,
        'participants.userId': user._id
      }).lean();
      
      if (!log) {
        return socket.emit('error', { message: '战斗记录不存在' });
      }
      
      socket.emit('battle_detail', log);
    });
    
    // 世界聊天
    socket.on('chat_world', async (data) => {
      const { content } = data;
      
      const message = new ChatMessage({
        channel: 'world',
        senderId: user._id,
        senderName: user.characterName,
        content,
        type: 'text'
      });
      await message.save();
      
      io.emit('chat_message', {
        channel: 'world',
        sender: user.characterName,
        content,
        timestamp: message.createdAt
      });
    });
    
    // 房间聊天
    socket.on('chat_room', async (data) => {
      const { content } = data;
      const roomId = user.location.roomId;
      
      const message = new ChatMessage({
        channel: 'room',
        senderId: user._id,
        senderName: user.characterName,
        content,
        type: 'text'
      });
      await message.save();
      
      io.to(`room:${roomId}`).emit('chat_message', {
        channel: 'room',
        sender: user.characterName,
        content,
        timestamp: message.createdAt
      });
    });
    
    // 私聊
    socket.on('chat_private', async (data) => {
      const { targetId, targetName, content } = data;
      
      // 支持按名字或ID查找
      let target;
      if (targetName) {
        target = await User.findOne({ characterName: targetName });
      } else if (targetId) {
        target = await User.findById(targetId);
      }
      
      if (!target) {
        return socket.emit('error', { message: '目标玩家不存在' });
      }
      
      const message = new ChatMessage({
        channel: 'private',
        senderId: user._id,
        senderName: user.characterName,
        receiverId: target._id,
        receiverName: target.characterName,
        content,
        type: 'text'
      });
      await message.save();
      
      socket.emit('chat_message', {
        channel: 'private',
        sender: user.characterName,
        receiver: target.characterName,
        content,
        timestamp: message.createdAt
      });
      
      // 发送给目标
      const targetSocket = findSocketByUserId(target._id);
      if (targetSocket) {
        targetSocket.emit('chat_message', {
          channel: 'private',
          sender: user.characterName,
          receiver: target.characterName,
          content,
          timestamp: message.createdAt
        });
      }
    });
    
    // ==================== 交易系统 ====================
    
    // 发起交易请求
    socket.on('trade_request', async (data) => {
      const { targetName } = data;
      
      // 查找目标玩家
      let targetSocketId = null;
      let targetUserId = null;
      for (const [sid, player] of onlinePlayers) {
        if (player.name === targetName) {
          targetSocketId = sid;
          targetUserId = player.userId;
          break;
        }
      }
      
      if (!targetSocketId) {
        return socket.emit('error', { message: `玩家 ${targetName} 不在线` });
      }
      
      // 检查是否同一房间
      const targetPlayer = onlinePlayers.get(targetSocketId);
      if (targetPlayer.location.roomId !== user.location.roomId) {
        return socket.emit('error', { message: '只能与同一房间的玩家交易' });
      }
      
      const result = tradeService.createTrade(
        socket.id, user._id, user.characterName,
        targetSocketId, targetUserId, targetName
      );
      
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      
      // 通知双方
      socket.emit('trade_started', { tradeId: result.tradeId, role: 'initiator', partner: targetName });
      io.to(targetSocketId).emit('trade_started', { tradeId: result.tradeId, role: 'receiver', partner: user.characterName });
    });
    
    // 添加物品到交易
    socket.on('trade_add_item', async (data) => {
      const { tradeId, itemId, quantity = 1 } = data;
      const itemConfig = getItem(itemId);
      if (!itemConfig) {
        return socket.emit('error', { message: '物品不存在' });
      }
      
      // 检查背包中是否有该物品
      const invItem = await Inventory.findOne({ userId: user._id, itemId, isEquipped: false });
      if (!invItem || invItem.quantity < quantity) {
        return socket.emit('error', { message: '背包中物品不足' });
      }
      
      const result = tradeService.addItem(tradeId, user._id, itemId, itemConfig.name, quantity);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      
      // 通知双方更新
      const trade = tradeService.getTradeState(tradeId);
      const tradeData = tradeService.activeTrades.get(tradeId);
      io.to(tradeData.initiator.socketId).emit('trade_updated', trade);
      io.to(tradeData.receiver.socketId).emit('trade_updated', trade);
    });
    
    // 设置交易金币
    socket.on('trade_set_gold', (data) => {
      const { tradeId, gold } = data;
      if (gold < 0 || gold > (user.gold || 0)) {
        return socket.emit('error', { message: '金币不足' });
      }
      
      const result = tradeService.setGold(tradeId, user._id, gold);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      
      const trade = tradeService.getTradeState(tradeId);
      const tradeData = tradeService.activeTrades.get(tradeId);
      io.to(tradeData.initiator.socketId).emit('trade_updated', trade);
      io.to(tradeData.receiver.socketId).emit('trade_updated', trade);
    });
    
    // 确认交易
    socket.on('trade_confirm', async (data) => {
      const { tradeId } = data;
      const result = tradeService.confirm(tradeId, user._id);
      
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      
      const tradeData = tradeService.activeTrades.get(tradeId);
      
      if (result.completed) {
        // 执行交易前重验证：确保双方物品和金币仍然有效
        const trade = tradeService.getTradeState(tradeId);

        // 验证发起方
        const initiatorGold = (await User.findById(tradeData.initiator.userId))?.gold || 0;
        if (trade.initiator.offer.gold > initiatorGold) {
          tradeService.cancel(tradeId, tradeData.initiator.userId);
          io.to(tradeData.initiator.socketId).emit('trade_cancelled', { tradeId, message: '金币不足，交易取消' });
          io.to(tradeData.receiver.socketId).emit('trade_cancelled', { tradeId, message: '对方金币不足，交易取消' });
          return;
        }
        for (const item of trade.initiator.offer.items) {
          const inv = await Inventory.findOne({ userId: tradeData.initiator.userId, itemId: item.itemId });
          if (!inv || inv.quantity < item.quantity) {
            tradeService.cancel(tradeId, tradeData.initiator.userId);
            io.to(tradeData.initiator.socketId).emit('trade_cancelled', { tradeId, message: '物品已变更，交易取消' });
            io.to(tradeData.receiver.socketId).emit('trade_cancelled', { tradeId, message: '对方物品已变更，交易取消' });
            return;
          }
        }

        // 验证接收方
        const receiverGold = (await User.findById(tradeData.receiver.userId))?.gold || 0;
        if (trade.receiver.offer.gold > receiverGold) {
          tradeService.cancel(tradeId, tradeData.receiver.userId);
          io.to(tradeData.initiator.socketId).emit('trade_cancelled', { tradeId, message: '对方金币不足，交易取消' });
          io.to(tradeData.receiver.socketId).emit('trade_cancelled', { tradeId, message: '金币不足，交易取消' });
          return;
        }
        for (const item of trade.receiver.offer.items) {
          const inv = await Inventory.findOne({ userId: tradeData.receiver.userId, itemId: item.itemId });
          if (!inv || inv.quantity < item.quantity) {
            tradeService.cancel(tradeId, tradeData.receiver.userId);
            io.to(tradeData.initiator.socketId).emit('trade_cancelled', { tradeId, message: '对方物品已变更，交易取消' });
            io.to(tradeData.receiver.socketId).emit('trade_cancelled', { tradeId, message: '物品已变更，交易取消' });
            return;
          }
        }

        // 转移发起方的物品给接收方
        for (const item of trade.initiator.offer.items) {
          await transferItem(tradeData.initiator.userId, tradeData.receiver.userId, item.itemId, item.quantity);
        }
        // 转移接收方的物品给发起方
        for (const item of trade.receiver.offer.items) {
          await transferItem(tradeData.receiver.userId, tradeData.initiator.userId, item.itemId, item.quantity);
        }
        // 转移金币
        if (trade.initiator.offer.gold > 0) {
          await User.findByIdAndUpdate(tradeData.initiator.userId, { $inc: { gold: -trade.initiator.offer.gold } });
          await User.findByIdAndUpdate(tradeData.receiver.userId, { $inc: { gold: trade.initiator.offer.gold } });
        }
        if (trade.receiver.offer.gold > 0) {
          await User.findByIdAndUpdate(tradeData.receiver.userId, { $inc: { gold: -trade.receiver.offer.gold } });
          await User.findByIdAndUpdate(tradeData.initiator.userId, { $inc: { gold: trade.receiver.offer.gold } });
        }
        
        io.to(tradeData.initiator.socketId).emit('trade_completed', { tradeId, message: '交易完成！' });
        io.to(tradeData.receiver.socketId).emit('trade_completed', { tradeId, message: '交易完成！' });

        // 双方交易统计
        await User.updateOne({ _id: tradeData.initiator.userId }, { $inc: { 'stats.tradesCompleted': 1 } });
        await User.updateOne({ _id: tradeData.receiver.userId }, { $inc: { 'stats.tradesCompleted': 1 } });
        checkAndAwardAchievements(tradeData.initiator.userId);
        checkAndAwardAchievements(tradeData.receiver.userId);
        dailyService.updateDailyTaskProgress(tradeData.initiator.userId, 'trade').catch(() => {});
        dailyService.updateDailyTaskProgress(tradeData.receiver.userId, 'trade').catch(() => {});
        actionLogService.log(tradeData.initiator.userId, tradeData.initiator.name, 'economy', 'trade', { with: tradeData.receiver.name, items: trade.initiator.offer.items, gold: trade.initiator.offer.gold }, user.location.roomId);
        actionLogService.log(tradeData.receiver.userId, tradeData.receiver.name, 'economy', 'trade', { with: tradeData.initiator.name, items: trade.receiver.offer.items, gold: trade.receiver.offer.gold }, user.location.roomId);
      } else {
        // 通知双方更新
        const trade = tradeService.getTradeState(tradeId);
        io.to(tradeData.initiator.socketId).emit('trade_updated', trade);
        io.to(tradeData.receiver.socketId).emit('trade_updated', trade);
      }
    });
    
    // 取消交易
    socket.on('trade_cancel', (data) => {
      const { tradeId } = data;
      const result = tradeService.cancel(tradeId, user._id);
      
      const tradeData = tradeService.activeTrades.get(tradeId);
      if (tradeData) {
        io.to(tradeData.initiator.socketId).emit('trade_cancelled', { tradeId });
        io.to(tradeData.receiver.socketId).emit('trade_cancelled', { tradeId });
      }
    });
    
    // 移除交易物品
    socket.on('trade_remove_item', (data) => {
      const { tradeId, itemId } = data;
      const result = tradeService.removeItem(tradeId, user._id, itemId);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      
      const trade = tradeService.getTradeState(tradeId);
      const tradeData = tradeService.activeTrades.get(tradeId);
      io.to(tradeData.initiator.socketId).emit('trade_updated', trade);
      io.to(tradeData.receiver.socketId).emit('trade_updated', trade);
    });
    
    // ==================== PVP竞技场 ====================
    
    // 发起PVP挑战
    socket.on('pvp_challenge', async (data) => {
      const { targetName } = data;
      
      // 不能挑战自己
      if (targetName === user.characterName) {
        return socket.emit('error', { message: '不能挑战自己' });
      }
      
      // 查找目标玩家
      let targetSocketId = null;
      let targetUserId = null;
      for (const [sid, player] of onlinePlayers) {
        if (player.name === targetName) {
          targetSocketId = sid;
          targetUserId = player.userId;
          break;
        }
      }
      
      if (!targetSocketId) {
        return socket.emit('error', { message: `玩家 ${targetName} 不在线` });
      }

      // 检查目标状态
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || targetUser.status === 'fighting') {
        return socket.emit('error', { message: `玩家 ${targetName} 正在战斗中` });
      }
      if (targetUser.status === 'dead') {
        return socket.emit('error', { message: `玩家 ${targetName} 已死亡` });
      }

      // 检查等级差（不超过10级）
      const targetPlayer = onlinePlayers.get(targetSocketId);
      if (Math.abs(user.level - targetPlayer.level) > 10) {
        return socket.emit('error', { message: '等级差距过大，无法挑战（不超过10级）' });
      }
      
      // 发送挑战请求
      io.to(targetSocketId).emit('pvp_challenge_received', {
        challengerName: user.characterName,
        challengerLevel: user.level
      });

      // 挑战超时（30秒）
      const challengeKey = `${user.characterName}:${targetName}`;
      const timeoutId = setTimeout(() => {
        io.to(targetSocketId).emit('pvp_challenge_expired', { challengerName: user.characterName });
        socket.emit('system_message', { message: `挑战 ${targetName} 已超时取消` });
        pvpChallenges.delete(challengeKey);
        pvpChallenges.delete(`${targetName}:${user.characterName}`);
      }, 30000);
      pvpChallenges.set(challengeKey, timeoutId);

      socket.emit('system_message', { message: `已向 ${targetName} 发出挑战，等待对方回应（30秒）...` });
    });
    
    // 接受PVP挑战
    socket.on('pvp_accept', async (data) => {
      const { challengerName } = data;
      
      // 查找挑战者
      let challengerSocketId = null;
      let challengerUserId = null;
      for (const [sid, player] of onlinePlayers) {
        if (player.name === challengerName) {
          challengerSocketId = sid;
          challengerUserId = player.userId;
          break;
        }
      }
      
      if (!challengerSocketId) {
        return socket.emit('error', { message: '挑战者已离线' });
      }

      // 清除挑战超时
      const key1 = `${challengerName}:${user.characterName}`;
      clearTimeout(pvpChallenges.get(key1));
      pvpChallenges.delete(key1);

      // 开始PVP战斗
      try {
        const battle = await battleService.startBattle(challengerUserId, user._id, 'pvp');
        const challengerSocket = io.sockets.sockets.get(challengerSocketId);
        if (challengerSocket) {
          challengerSocket.join(`battle:${battle.battleId}`);
          challengerSocket.emit('battle_started', battle);
        }
        socket.join(`battle:${battle.battleId}`);
        socket.emit('battle_started', battle);
      } catch (err) {
        socket.emit('error', { message: err.message || 'PVP战斗启动失败' });
      }
    });
    
    // 拒绝PVP挑战
    socket.on('pvp_decline', (data) => {
      const { challengerName } = data;

      // 清除挑战超时
      clearTimeout(pvpChallenges.get(`${challengerName}:${user.characterName}`));
      pvpChallenges.delete(`${challengerName}:${user.characterName}`);

      for (const [sid, player] of onlinePlayers) {
        if (player.name === challengerName) {
          io.to(sid).emit('system_message', { message: `${user.characterName} 拒绝了你的挑战` });
          break;
        }
      }
    });
    
    // ==================== 成就系统 ====================
    
    // 获取成就列表
    socket.on('get_achievements', async () => {
      const achievements = await achievementService.getPlayerAchievements(user._id);
      const allConfigs = achievementService.getAllConfigs();
      socket.emit('achievements', {
        achieved: achievements,
        available: allConfigs
      });
    });
    
    // ==================== 锻造系统 ====================
    
    // 获取锻造配方
    socket.on('get_forge_recipes', async () => {
      const skills = await craftService.getLifeSkills(user._id);
      const level = (skills.forging?.level) || 1;
      const recipes = craftService.getRecipesBySkill('forging', level + 2);
      socket.emit('forge_recipes', { recipes });
    });

    // 获取生活技能熟练度
    socket.on('get_life_skills', async () => {
      const skills = await craftService.getLifeSkills(user._id);
      socket.emit('life_skills', skills);
    });
    
    // 执行锻造
    socket.on('forge', async (data) => {
      const { recipeId } = data;
      const result = await craftService.performCraft(user._id, 'forging', recipeId, user.gold);
      if (result.error) return socket.emit('error', { message: result.error });
      if (result.success) {
        user.gold -= result.goldCost;
        await user.save();
        socket.emit('forge_success', result);
        socket.emit('system_message', { content: `锻造成功！获得了 ${result.resultItemName}×${result.quantity}` });
        user.stats = user.stats || {};
        user.stats.craftingCount = (user.stats.craftingCount || 0) + 1;
        await user.save();
        checkAndAwardAchievements(user._id);
        dailyService.updateDailyTaskProgress(user._id, 'craft').catch(() => {});
      } else {
        user.gold -= result.goldCost;
        await user.save();
        socket.emit('forge_failed', result);
        socket.emit('system_message', { content: result.message });
      }
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });
    
    // ==================== 生活技能：三系采集 + 三系制造 ====================

    // 查看可采集资源（三系合并）
    socket.on('list_gathering_nodes', async () => {
      const roomId = user.location.roomId;
      const nodes = await craftService.getAllGatheringNodes(roomId, user._id);
      socket.emit('gathering_nodes', { roomId, nodes });
    });

    // 采集
    socket.on('gather', async (data) => {
      const { skillType, nodeId } = data;
      const result = await craftService.gather(user._id, skillType, nodeId);
      if (result.error) return socket.emit('error', { message: result.error });
      socket.emit('gather_success', result);
      socket.emit('system_message', { content: `采集成功！获得了 ${result.itemName}×${result.quantity}` });
      dailyService.updateDailyTaskProgress(user._id, 'gather').catch(() => {});
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // 查看炼药配方
    socket.on('list_alchemy_recipes', async () => {
      const skills = await craftService.getLifeSkills(user._id);
      const level = (skills.alchemy?.level) || 1;
      const recipes = craftService.getRecipesBySkill('alchemy', level + 2); // show upcoming 2 levels
      socket.emit('alchemy_recipes', { recipes });
    });

    // 炼药
    socket.on('alchemy', async (data) => {
      const { recipeId } = data;
      const result = await craftService.performCraft(user._id, 'alchemy', recipeId, user.gold);
      if (result.error) return socket.emit('error', { message: result.error });
      if (result.success) {
        user.gold -= result.goldCost;
        await user.save();
        socket.emit('alchemy_success', result);
        socket.emit('system_message', { content: `炼药成功！获得了 ${result.resultItemName}×${result.quantity}` });
        user.stats = user.stats || {};
        user.stats.craftingCount = (user.stats.craftingCount || 0) + 1;
        await user.save();
        checkAndAwardAchievements(user._id);
        dailyService.updateDailyTaskProgress(user._id, 'craft').catch(() => {});
      } else {
        user.gold -= result.goldCost;
        await user.save();
        socket.emit('alchemy_failed', result);
        socket.emit('system_message', { content: result.message });
      }
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // 查看烹饪配方
    socket.on('list_cooking_recipes', async () => {
      const skills = await craftService.getLifeSkills(user._id);
      const level = (skills.cooking?.level) || 1;
      const recipes = craftService.getRecipesBySkill('cooking', level + 2);
      socket.emit('cooking_recipes', { recipes });
    });

    // 烹饪
    socket.on('cooking', async (data) => {
      const { recipeId } = data;
      const result = await craftService.performCraft(user._id, 'cooking', recipeId, user.gold);
      if (result.error) return socket.emit('error', { message: result.error });
      if (result.success) {
        user.gold -= result.goldCost;
        await user.save();
        socket.emit('cooking_success', result);
        socket.emit('system_message', { content: `烹饪成功！获得了 ${result.resultItemName}×${result.quantity}` });
        user.stats = user.stats || {};
        user.stats.craftingCount = (user.stats.craftingCount || 0) + 1;
        await user.save();
        checkAndAwardAchievements(user._id);
        dailyService.updateDailyTaskProgress(user._id, 'craft').catch(() => {});
      } else {
        user.gold -= result.goldCost;
        await user.save();
        socket.emit('cooking_failed', result);
        socket.emit('system_message', { content: result.message });
      }
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // ==================== 天气/时间系统 ====================
    
    // 获取当前时间
    socket.on('get_time', () => {
      const timeInfo = weatherTimeService.formatGameTime();
      const weather = weatherTimeService.getRoomWeather(user.location?.roomId || 'village_center');
      socket.emit('time_info', {
        ...timeInfo,
        weather: { name: weather.name, description: weather.description, effects: weather.effects }
      });
    });

    // ==================== 每日活跃系统 ====================

    // 签到
    socket.on('daily_checkin', async () => {
      const result = await dailyService.checkIn(user._id);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('daily_checkin_result', result);
      socket.emit('system_message', { content: `签到成功！连续签到 ${result.streak} 天，获得经验 ${result.reward.exp}、金币 ${result.reward.gold}` });
      // 更新签到统计并检查成就
      if (user) {
        user.stats = user.stats || {};
        user.stats.checkinStreak = result.streak;
        user.stats.goldEarned = (user.stats.goldEarned || 0) + (result.reward?.gold || 0);
        await user.save();
        checkAndAwardAchievements(user._id);
      }
      const status = await dailyService.getDailyStatus(user._id);
      socket.emit('daily_status', status);
    });

    // 获取每日状态
    socket.on('get_daily_status', async () => {
      const status = await dailyService.getDailyStatus(user._id);
      socket.emit('daily_status', status);
    });

    // 领取每日任务奖励
    socket.on('claim_daily_task', async (data) => {
      const { taskId } = data;
      const result = await dailyService.claimDailyTask(user._id, taskId);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('daily_task_claimed', result);
      socket.emit('system_message', { content: `每日任务完成！获得经验 ${result.reward.exp}、金币 ${result.reward.gold}、活跃度 ${result.reward.activityPoints}` });
      const status = await dailyService.getDailyStatus(user._id);
      socket.emit('daily_status', status);
    });

    // 领取活跃度奖励
    socket.on('claim_activity_reward', async (data) => {
      const { points } = data;
      const result = await dailyService.claimActivityReward(user._id, points);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('activity_reward_claimed', result);
      socket.emit('system_message', { content: `活跃度奖励领取成功！获得经验 ${result.reward.exp}、金币 ${result.reward.gold}` });
      const status = await dailyService.getDailyStatus(user._id);
      socket.emit('daily_status', status);
    });

    // ==================== 拍卖行系统 ====================

    // 搜索拍卖
    socket.on('auction_search', async (data = {}) => {
      const result = await auctionService.searchListings(data, data.page || 1, data.limit || 20);
      socket.emit('auction_listings', result);
    });

    // 我的挂单
    socket.on('auction_my_listings', async () => {
      const listings = await auctionService.getMyListings(user._id);
      socket.emit('auction_my_listings', { listings });
    });

    // 挂单
    socket.on('auction_create', async (data) => {
      const { itemId, quantity, unitPrice, duration } = data;
      const result = await auctionService.createListing(user._id, user.characterName, itemId, quantity, unitPrice, duration);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('auction_created', result);
      socket.emit('system_message', { content: `已上架 ${result.listing.itemName}×${result.listing.quantity}，单价 ${result.listing.unitPrice} 金币，手续费 ${result.fee} 金币` });
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // 购买拍卖物品
    socket.on('auction_buy', async (data) => {
      const { listingId } = data;
      const result = await auctionService.buyListing(listingId, user._id, user.characterName);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('auction_bought', result);
      socket.emit('system_message', { content: `购买成功！获得 ${result.listing.itemName}×${result.listing.quantity}，花费 ${result.listing.totalPrice} 金币` });
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // 取消挂单
    socket.on('auction_cancel', async (data) => {
      const { listingId } = data;
      const result = await auctionService.cancelListing(listingId, user._id);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('auction_cancelled', result);
      socket.emit('system_message', { content: result.message });
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // ==================== 副本系统 ====================

    // 查看副本列表
    socket.on('list_dungeons', async () => {
      const allDungeons = instanceService.getAllDungeons().map(d => {
        const cd = instanceService.checkCooldown(user._id, d.id);
        return {
        id: d.id,
        name: d.name,
        type: d.type,
        description: d.description,
        requireLevel: d.requireLevel,
        requireItem: d.requireItem,
        dailyLimit: d.dailyLimit,
        entryRoomId: d.entryRoomId,
        cdMinutes: d.cdMinutes || 0,
        onCooldown: cd?.onCooldown || false,
        cooldownRemaining: cd?.remainingMinutes || 0
      };
    });
      socket.emit('dungeons_list', { dungeons: allDungeons });
    });

    // 进入副本
    socket.on('enter_dungeon', async (data) => {
      const { dungeonId } = data;
      const result = await instanceService.enterDungeon(user._id, dungeonId);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('dungeon_entered', result);
      socket.emit('system_message', { content: `进入副本：${result.dungeon.name}（今日剩余 ${result.dungeon.dailyLimit - result.dungeon.runsToday} 次）` });
    });

    // 获取下一波怪物
    socket.on('dungeon_next_wave', async (data) => {
      const { dungeonId } = data;
      const result = await instanceService.getNextWave(user._id, dungeonId);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      if (result.complete) {
        const completeResult = await instanceService.completeDungeon(user._id, dungeonId);
        socket.emit('dungeon_completed', completeResult);
        socket.emit('system_message', { content: `副本通关！获得经验 ${completeResult.rewards.exp}、金币 ${completeResult.rewards.gold}` });
        // 更新统计
        const freshUser = await User.findById(user._id);
        if (freshUser) {
          freshUser.stats = freshUser.stats || {};
          freshUser.stats.dungeonsCompleted = (freshUser.stats.dungeonsCompleted || 0) + 1;
          freshUser.stats.goldEarned = (freshUser.stats.goldEarned || 0) + (completeResult.rewards?.gold || 0);
          await freshUser.save();
          checkAndAwardAchievements(user._id);
        }
        return;
      }
      socket.emit('dungeon_wave', result);
    });

    // 波次完成（玩家击败当前波次所有怪物后调用）
    socket.on('dungeon_wave_complete', async (data) => {
      const { dungeonId } = data;
      await instanceService.completeWave(user._id, dungeonId);
      socket.emit('system_message', { content: '击败了当前波次！准备下一波...' });
    });

    // 退出副本
    socket.on('leave_dungeon', async (data) => {
      const { dungeonId } = data;
      const result = await instanceService.leaveDungeon(user._id, dungeonId);
      socket.emit('dungeon_left', result);
      socket.emit('system_message', { content: result.message });
    });

    // ==================== 万安塔 — 爬塔副本 ====================

    // 获取塔层信息
    socket.on('tower_floor_info', (data) => {
      const { dungeonId } = data;
      const result = instanceService.getTowerFloor(user._id, dungeonId);
      if (result.error) return socket.emit('error', { message: result.error });
      socket.emit('tower_floor', result);
    });

    // 挑战本层（开始战斗）
    socket.on('tower_floor_complete', async (data) => {
      const { dungeonId } = data;
      const floorInfo = instanceService.getTowerFloor(user._id, dungeonId);
      if (floorInfo.error) return socket.emit('error', { message: floorInfo.error });
      if (floorInfo.exited) return socket.emit('error', { message: '已退出万安塔' });

      const monsterId = floorInfo.monsters?.[0]?.monsterId;
      if (!monsterId) return socket.emit('error', { message: '本层没有怪物' });

      try {
        // 检查玩家状态
        await user.save(); // 确保战斗前状态已持久化
        const battle = await battleService.startBattle(user._id, monsterId, 'pve');
        battle._dungeonMeta = { type: 'tower', dungeonId, floor: floorInfo.floor };

        const battleRoom = `battle:${battle.battleId}`;
        battle._roomName = battleRoom;
        battle._dungeonMeta = { type: 'tower', dungeonId };
        dungeonBattleContexts.set(battle.battleId, { type: 'tower', dungeonId });
        socket.join(battleRoom);
        socket.emit('battle_started', battle);

        // 自动处理怪物回合
        let autoResult = { battle };
        let autoCount = 0;
        while (autoResult.battle.status === 'active' && autoCount < 10) {
          const nextActor = battleService.getCurrentParticipant(battle.battleId);
          if (!nextActor?.isMonster) break;

          const monsterAction = battleService.chooseAutomatedAction(battle.battleId);
          const release = await battleService.acquireLock(battle.battleId);
          try {
            autoResult = await battleService.executeTurn(battle.battleId, monsterAction.action, monsterAction.skillId);
          } finally {
            battleService.releaseLock(battle.battleId, release);
          }
          io.to(battleRoom).emit('battle_update', autoResult);
          autoCount++;
        }

        if (autoResult.battle.status === 'ended' || autoResult.battle.status === 'fled') {
          io.to(battleRoom).emit('battle_ended', autoResult);
          io.in(battleRoom).socketsLeave(battleRoom);
          // 同步用户状态
          const synced = await User.findById(user._id, 'status hp mp exp gold level freePoints stats').lean();
          if (synced) Object.assign(user, synced);
          // 处理副本逻辑
          await handleDungeonBattleEnd(battle, autoResult);
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // 敲锣退出（领取累积奖励）
    socket.on('tower_exit', async (data) => {
      const { dungeonId } = data;
      const result = await instanceService.exitTower(user._id, dungeonId);
      if (result.error) return socket.emit('error', { message: result.error });
      socket.emit('tower_exited', result);
      socket.emit('system_message', { content: result.message });
    });

    // ==================== 藏经阁 — 潜行副本 ====================

    // 开始潜行
    socket.on('stealth_start', (data) => {
      const { dungeonId } = data;
      const result = instanceService.startStealth(user._id, dungeonId);
      if (result.error) return socket.emit('error', { message: result.error });
      socket.emit('stealth_started', result);
      socket.emit('system_message', { content: result.message });
    });

    // 潜行移动
    socket.on('stealth_move', async (data) => {
      const { battleId } = data;
      const stealthState = instanceService.getStealthState(battleId);
      const dungeon = instanceService.getDungeon(stealthState?.dungeonId);
      const result = instanceService.moveStealth(battleId);
      // 注入怪物ID供战斗使用
      if (result.type === 'detected' && dungeon?.patrolMonsterId) {
        data.monsterId = dungeon.patrolMonsterId;
      }
      if (result.error) return socket.emit('error', { message: result.error });

      switch (result.type) {
        case 'move':
          socket.emit('stealth_moved', result);
          break;
        case 'detected':
          socket.emit('stealth_detected', result);
          socket.emit('system_message', { content: result.message });
          // P6: 遭遇巡逻僧兵 → 进入战斗
          if (data.monsterId) {
            try {
              const battle = await battleService.startBattle(user._id, data.monsterId, 'pve');
              const bRoom = `battle:${battle.battleId}`;
              battle._roomName = bRoom;
              dungeonBattleContexts.set(battle.battleId, { type: 'stealth', battleId: data.battleId });
              socket.join(bRoom);
              socket.emit('battle_started', battle);
              // 怪物先手自动回合
              let sr = { battle };
              let ac = 0;
              while (sr.battle.status === 'active' && ac < 10) {
                const na = battleService.getCurrentParticipant(battle.battleId);
                if (!na?.isMonster) break;
                const ma = battleService.chooseAutomatedAction(battle.battleId);
                const rel = await battleService.acquireLock(battle.battleId);
                try { sr = await battleService.executeTurn(battle.battleId, ma.action, ma.skillId); }
                finally { battleService.releaseLock(battle.battleId, rel); }
                io.to(bRoom).emit('battle_update', sr);
                ac++;
              }
              if (sr.battle.status === 'ended' || sr.battle.status === 'fled') {
                io.to(bRoom).emit('battle_ended', sr);
                io.in(bRoom).socketsLeave(bRoom);
                await handleDungeonBattleEnd(battle, sr);
              }
            } catch (e) {
              socket.emit('error', { message: '战斗初始化失败: ' + e.message });
            }
          }
          break;
        case 'found_item':
          socket.emit('stealth_item_found', result);
          socket.emit('system_message', { content: result.message });
          break;
        case 'layer_complete':
          socket.emit('stealth_layer_complete', result);
          socket.emit('system_message', { content: result.message });
          break;
        case 'dungeon_complete':
          socket.emit('stealth_completed', result);
          socket.emit('system_message', { content: `藏经阁探索完成！获得积分：${result.score}，收集残页：${result.collected}份。` });
          break;
        case 'failed':
          socket.emit('stealth_failed', result);
          socket.emit('system_message', { content: result.message });
          break;
      }
    });

    // ==================== 鄱阳湖漂流 — 航海副本 ====================

    // 开始漂流
    socket.on('drift_start', (data) => {
      const { dungeonId, mode } = data;
      const result = instanceService.startDrift(user._id, dungeonId, mode || 'normal');
      if (result.error) return socket.emit('error', { message: result.error });
      socket.emit('drift_started', result);
      socket.emit('system_message', { content: result.message });
    });

    // 船控指令
    socket.on('drift_command', async (data) => {
      const { battleId, command } = data;
      const result = instanceService.shipNavigate(battleId, command);
      if (result.error) return socket.emit('error', { message: result.error });

      if (result.returned) {
        socket.emit('drift_completed', result);
        socket.emit('system_message', { content: result.message });
        // P6: 设置漂流CD
        instanceService.setDungeonCooldown(user._id, result.dungeonId || data.dungeonId);
      } else if (result.encounter) {
        socket.emit('drift_encounter', result);
        // P6: 遭遇水贼 → 进入战斗
        const enc = result.encounter;
        if (enc.monsterId) {
          try {
            const battle = await battleService.startBattle(user._id, enc.monsterId, 'pve');
            const bRoom = `battle:${battle.battleId}`;
            battle._roomName = bRoom;
            dungeonBattleContexts.set(battle.battleId, { type: 'drift', battleId: data.battleId });
            socket.join(bRoom);
            socket.emit('battle_started', battle);
            // 怪物先手自动回合
            let dr = { battle };
            let dc = 0;
            while (dr.battle.status === 'active' && dc < 10) {
              const na = battleService.getCurrentParticipant(battle.battleId);
              if (!na?.isMonster) break;
              const ma = battleService.chooseAutomatedAction(battle.battleId);
              const rel = await battleService.acquireLock(battle.battleId);
              try { dr = await battleService.executeTurn(battle.battleId, ma.action, ma.skillId); }
              finally { battleService.releaseLock(battle.battleId, rel); }
              io.to(bRoom).emit('battle_update', dr);
              dc++;
            }
            if (dr.battle.status === 'ended' || dr.battle.status === 'fled') {
              io.to(bRoom).emit('battle_ended', dr);
              io.in(bRoom).socketsLeave(bRoom);
              await handleDungeonBattleEnd(battle, dr);
            }
          } catch (e) {
            socket.emit('error', { message: '水贼战斗初始化失败: ' + e.message });
          }
        }
      } else {
        socket.emit('drift_navigated', result);
        socket.emit('system_message', { content: result.message });
      }
    });

    // ==================== 帮派系统 ====================

    // 创建帮派
    socket.on('gang_create', async (data) => {
      const { name, description } = data;
      const result = await gangService.createGang(user._id, name, description);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('gang_created', result);
      io.emit('system_message', { content: `${user.characterName} 创建了帮派「${result.gang.name}」！` });
      // 更新帮派统计
      user.stats = user.stats || {};
      user.stats.gangJoined = true;
      await user.save();
      checkAndAwardAchievements(user._id);
    });

    // 搜索帮派
    socket.on('gang_search', async (data = {}) => {
      const gangs = await gangService.searchGangs(data.query || '');
      socket.emit('gang_search_result', { gangs });
    });

    // 加入帮派
    socket.on('gang_join', async (data) => {
      const { gangName } = data;
      const result = await gangService.joinGang(user._id, gangName);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('gang_joined', result);
      socket.emit('system_message', { content: `加入了帮派「${gangName}」` });
      const info = await gangService.getGangInfo(user._id);
      if (info) socket.emit('gang_info', info);
    });

    // 退出帮派
    socket.on('gang_leave', async () => {
      const result = await gangService.leaveGang(user._id);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('gang_left', result);
      socket.emit('system_message', { content: result.message });
    });

    // 查看帮派信息
    socket.on('gang_info', async () => {
      const info = await gangService.getGangInfo(user._id);
      if (!info) {
        return socket.emit('error', { message: '你未加入任何帮派' });
      }
      socket.emit('gang_info', info);
    });

    // 帮派捐献
    socket.on('gang_donate', async (data) => {
      const { gold, itemId, itemQuantity } = data;
      const result = await gangService.donateToGang(user._id, gold || 0, itemId, itemQuantity);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('gang_donation_complete', result);
      socket.emit('system_message', { content: `捐献成功！贡献 +${result.contributionGained}` });
      const info = await gangService.getGangInfo(user._id);
      if (info) socket.emit('gang_info', info);
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // 从帮派仓库取物品
    socket.on('gang_withdraw', async (data) => {
      const { itemId, quantity } = data;
      const result = await gangService.withdrawFromWarehouse(user._id, itemId, quantity);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      socket.emit('gang_withdraw_complete', result);
      socket.emit('system_message', { content: `从帮派仓库取出了 ${result.itemName}×${result.quantity}` });
      const info = await gangService.getGangInfo(user._id);
      if (info) socket.emit('gang_info', info);
      const items = await Inventory.find({ userId: user._id });
      socket.emit('inventory_updated', items);
    });

    // 帮派聊天
    socket.on('chat_gang', async (data) => {
      const { content } = data;
      const result = await gangService.sendGangMessage(user._id, user.characterName, content);
      if (result.error) {
        return socket.emit('error', { message: result.error });
      }
      // 广播给帮派所有在线成员
      const gang = await Gang.findOne({ _id: result.gangId });
      if (gang) {
        for (const member of gang.members) {
          const memberSocket = findSocketByUserId(member.userId);
          if (memberSocket) {
            memberSocket.emit('chat_message', {
              channel: 'gang',
              gangName: result.gangName,
              sender: result.senderName,
              content,
              timestamp: new Date()
            });
          }
        }
      }
    });

    // ==================== 门派相关 ====================
    
    // 查看门派列表
    socket.on('list_factions', async () => {
      socket.emit('factions_list', getAllFactions());
    });
    
    // 加入门派
    socket.on('join_faction', async (data) => {
      const { factionId } = data;
      const faction = getFaction(factionId);

      if (!faction) {
        return socket.emit('error', { message: '门派不存在' });
      }

      if (user.faction) {
        return socket.emit('error', { message: '已加入门派，需先退出当前门派' });
      }

      // 检查等级要求
      if (faction.requireLevel && user.level < faction.requireLevel) {
        return socket.emit('error', { message: `需要等级 ${faction.requireLevel}` });
      }

      // 检查入门考核是否完成
      if (faction.entryExamId) {
        const examCompleted = await Quest.findOne({
          userId: user._id,
          questId: faction.entryExamId,
          status: 'completed'
        });
        if (!examCompleted) {
          return socket.emit('error', {
            message: `你需要先完成「${faction.name}入门考核」才能加入。请找门派招募NPC接取考核任务。`
          });
        }
      }

      user.faction = factionId;
      user.factionReputation = 0;
      user.factionContribution = 0;
      user.factionRank = 'disciple';
      await user.save();
      
      socket.emit('faction_joined', {
        faction,
        learnableSkills: getLearnableSkills(factionId, user.level, user.factionRank)
      });
      actionLogService.log(user._id, user.characterName, 'faction', 'join', { factionId, factionName: faction.name }, user.location.roomId);

      // 任务进度
      questProgressService.checkProgress(user._id, { type: 'join_faction' }).catch(() => {});

      // 广播
      io.emit('system_message', {
        content: `${user.characterName} 加入了 ${faction.name}！`
      });

      checkAndAwardAchievements(user._id);
    });
    
    // 退出门派
    socket.on('leave_faction', async () => {
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      
      const faction = getFaction(user.faction);
      const factionName = faction?.name || user.faction;
      
      user.faction = null;
      user.factionReputation = 0;
      user.factionContribution = 0;
      user.factionRank = 'disciple';
      await user.save();
      
      socket.emit('faction_left', {
        factionName,
        message: `你已退出 ${factionName}`
      });
    });
    
    // 门派进阶
    socket.on('faction_advance', async () => {
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      
      if (!user.canFactionAdvance()) {
        return socket.emit('error', { message: '门派进阶条件未满足（需要足够的声望和等级）' });
      }
      
      const oldRank = user.factionRank;
      user.factionAdvance();
      await user.save();
      
      const rankNames = {
        disciple: '弟子',
        deacon: '执事',
        elder: '长老',
        leader: '掌门'
      };
      
      socket.emit('faction_advanced', {
        oldRank,
        newRank: user.factionRank,
        oldRankName: rankNames[oldRank],
        newRankName: rankNames[user.factionRank],
        freePoints: user.freePoints
      });
      
      io.emit('system_message', {
        content: `${user.characterName} 在${getFaction(user.faction)?.name}中晋升为${rankNames[user.factionRank]}！`
      });

      checkAndAwardAchievements(user._id);
      actionLogService.log(user._id, user.characterName, 'faction', 'advance', { factionId: user.faction, oldRank, newRank: user.factionRank }, user.location.roomId);
    });

    // 门派任务（贡献门派获取声望）
    socket.on('faction_task', async () => {
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      
      // 门派任务：捐献金币获取声望
      const donation = 100; // 每次捐献100金币
      if (user.gold < donation) {
        return socket.emit('error', { message: '金币不足，需要100金币捐献' });
      }
      
      user.gold -= donation;
      user.factionContribution += donation;
      user.factionReputation += 10; // 每次捐献获得10声望
      
      // 检查门派进阶
      if (user.canFactionAdvance()) {
        socket.emit('system_message', {
          content: '你的门派声望已达到进阶条件！可以使用 faction_advance 进行进阶。'
        });
      }
      
      await user.save();
      
      socket.emit('faction_task_completed', {
        goldDonated: donation,
        reputationGained: 10,
        totalReputation: user.factionReputation,
        totalContribution: user.factionContribution,
        factionRank: user.factionRank
      });
    });

    // 查看门派任务列表
    socket.on('list_faction_quests', async () => {
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      const quests = getFactionQuestsByFaction(user.faction);
      // 检查哪些已接取/已完成
      const questRecords = await Quest.find({ userId: user._id, questId: { $in: quests.map(q => q.id) } });
      const questStatus = {};
      for (const rec of questRecords) {
        questStatus[rec.questId] = { status: rec.status, rewardClaimed: rec.rewardClaimed };
      }
      socket.emit('faction_quests_list', {
        factionId: user.faction,
        quests: quests.map(q => ({
          ...q,
          playerStatus: questStatus[q.id] || null
        }))
      });
    });

    // 接取门派任务
    socket.on('accept_faction_quest', async (data) => {
      const { questId } = data;
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      const questConfig = getFactionQuest(questId);
      if (!questConfig || questConfig.factionId !== user.faction) {
        return socket.emit('error', { message: '此门派任务不存在' });
      }
      // 检查门派等级
      const rankOrder = ['disciple', 'deacon', 'elder', 'leader'];
      if (questConfig.minFactionRank && rankOrder.indexOf(user.factionRank) < rankOrder.indexOf(questConfig.minFactionRank)) {
        return socket.emit('error', { message: `门派等级不足，需要 ${questConfig.minFactionRank}` });
      }
      // 检查每日重置
      const existing = await Quest.findOne({ userId: user._id, questId });
      if (existing) {
        if (questConfig.dailyReset) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (existing.completedAt && existing.completedAt >= today) {
            return socket.emit('error', { message: '今日已完成此任务，明天再来吧' });
          }
          // 新的一天，删除旧记录
          await Quest.deleteOne({ _id: existing._id });
        } else if (existing.status === 'completed') {
          return socket.emit('error', { message: '已完成此任务' });
        } else {
          return socket.emit('error', { message: '已接取此任务' });
        }
      }
      const newQuest = new Quest({ userId: user._id, questId, status: 'accepted' });
      await newQuest.save();
      // 回溯检查
      const backfillEvents = [];
      for (const obj of questConfig.objectives || []) {
        if (obj.type === 'talk' && obj.npcId) {
          // NPC对话目标，需要玩家主动对话
        } else if (obj.type === 'visit' && obj.roomId && user.location.roomId === obj.roomId) {
          backfillEvents.push({ type: 'visit', target: obj.roomId });
        }
      }
      for (const event of backfillEvents) {
        await questProgressService.checkProgress(user._id, event);
      }
      socket.emit('faction_quest_accepted', { quest: questConfig });
      socket.emit('system_message', { content: `接取门派任务：${questConfig.name}` });
    });

    // 完成门派任务（领取奖励）
    socket.on('complete_faction_quest', async (data) => {
      const { questId } = data;
      const quest = await Quest.findOne({ userId: user._id, questId, status: 'completed', rewardClaimed: false });
      if (!quest) {
        return socket.emit('error', { message: '任务未完成或已领取奖励' });
      }
      const questConfig = getFactionQuest(questId);
      if (!questConfig) {
        return socket.emit('error', { message: '任务配置不存在' });
      }
      const rewards = questConfig.rewards;
      if (rewards) {
        if (rewards.exp) user.exp += rewards.exp;
        if (rewards.gold) user.gold += rewards.gold;
        if (rewards.factionReputation) user.factionReputation += rewards.factionReputation;
        if (rewards.factionContribution) user.factionContribution = (user.factionContribution || 0) + rewards.factionContribution;
        if (rewards.items) {
          for (const itemId of rewards.items) {
            await Inventory.create({ userId: user._id, itemId, quantity: 1 });
          }
        }
        if (user.canLevelUp()) user.levelUp();
        await user.save();
      }
      quest.rewardClaimed = true;
      quest.completedAt = new Date();
      await quest.save();
      socket.emit('faction_quest_completed', { quest: questConfig, rewards: questConfig.rewards });
      const contribMsg = rewards.factionContribution ? `，门派贡献+${rewards.factionContribution}` : '';
      socket.emit('system_message', { content: `门派任务完成：${questConfig.name}！${contribMsg}` });
      user.stats.questsCompleted = (user.stats.questsCompleted || 0) + 1;
      await user.save();
      checkAndAwardAchievements(user._id);
    });

    // ==================== 门派贡献兑换 ====================

    // 查看可兑换列表
    socket.on('faction_exchange_list', async () => {
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      const faction = getFaction(user.faction);
      if (!faction) return socket.emit('error', { message: '门派不存在' });

      // 列出可用贡献兑换的技能（按当前等级和门派等级过滤）
      const allSkills = getLearnableSkills(user.faction, user.level, user.factionRank);
      const exchangeList = allSkills.map(skill => ({
        ...skill,
        contributionCost: (skill.learnPrice || 100) // 贡献值兑换：与原价1:1但不消耗金币
      }));

      socket.emit('faction_exchange_list', {
        factionId: user.faction,
        factionName: faction.name,
        myContribution: user.factionContribution,
        myRank: user.factionRank,
        items: exchangeList
      });
    });

    // 用贡献兑换技能或物品
    socket.on('faction_exchange', async (data) => {
      const { skillId, itemId } = data;
      if (!user.faction) {
        return socket.emit('error', { message: '你还没有加入门派' });
      }
      const faction = getFaction(user.faction);
      if (!faction) return socket.emit('error', { message: '门派不存在' });

      // 兑换技能
      if (skillId) {
        const allSkills = getLearnableSkills(user.faction, user.level, user.factionRank);
        const skill = allSkills.find(s => s.id === skillId);
        if (!skill) {
          return socket.emit('error', { message: '该技能不在你可兑换的范围内（需满足等级和门派等级要求）' });
        }
        const contributionCost = skill.learnPrice || 100;
        if (user.factionContribution < contributionCost) {
          return socket.emit('error', { message: `门派贡献不足，需要 ${contributionCost} 贡献（当前: ${user.factionContribution}）` });
        }
        if (user.skills.includes(skillId)) {
          return socket.emit('error', { message: '你已经学会了这个技能' });
        }
        user.factionContribution -= contributionCost;
        user.skills.push(skillId);
        await user.save();
        socket.emit('faction_exchanged', {
          skillId, skillName: skill.name, cost: contributionCost,
          remainingContribution: user.factionContribution
        });
        socket.emit('system_message', { content: `用 ${contributionCost} 门派贡献兑换了技能「${skill.name}」！` });
        actionLogService.log(user._id, user.characterName, 'faction', 'exchange_skill',
          { factionId: user.faction, skillId, cost: contributionCost }, user.location.roomId);
      }
      // 兑换物品
      else if (itemId) {
        const itemConfig = getItem(itemId);
        if (!itemConfig) {
          return socket.emit('error', { message: '物品不存在' });
        }
        // 物品兑换价格：按稀有度定价，默认30贡献起
        const itemCost = itemConfig.contributionCost || (itemConfig.price ? Math.ceil(itemConfig.price / 10) : 30);
        if (user.factionContribution < itemCost) {
          return socket.emit('error', { message: `门派贡献不足，需要 ${itemCost} 贡献（当前: ${user.factionContribution}）` });
        }
        user.factionContribution -= itemCost;
        await user.save();
        await Inventory.create({ userId: user._id, itemId, quantity: 1 });
        socket.emit('faction_exchanged', {
          itemId, itemName: itemConfig.name, cost: itemCost,
          remainingContribution: user.factionContribution
        });
        socket.emit('system_message', { content: `用 ${itemCost} 门派贡献兑换了「${itemConfig.name}」！` });
        actionLogService.log(user._id, user.characterName, 'faction', 'exchange_item',
          { factionId: user.faction, itemId, cost: itemCost }, user.location.roomId);
      } else {
        return socket.emit('error', { message: '请指定要兑换的技能ID或物品ID' });
      }
    });

    // ==================== NPC对话 ====================

    socket.on('talk_npc', async (data) => {
      const { npcId } = data;
      const room = getRoom(user.location.roomId);

      if (!room) {
        return socket.emit('error', { message: '当前位置无效' });
      }

      // 检查NPC是否在当前房间
      const npcs = getNpcsInRoom(room.id);
      const npc = npcs.find(n => n.id === npcId);

      if (!npc) {
        return socket.emit('error', { message: '此NPC不在当前房间' });
      }

      // 获取NPC对话（支持随机变体数组）
      const greeting = npc.dialogues?.greeting;
      const defaultDialog = npc.dialogues?.default;
      let dialog;
      if (Array.isArray(greeting)) {
        dialog = greeting[Math.floor(Math.random() * greeting.length)];
      } else if (greeting) {
        dialog = greeting;
      } else if (Array.isArray(defaultDialog)) {
        dialog = defaultDialog[Math.floor(Math.random() * defaultDialog.length)];
      } else if (defaultDialog) {
        dialog = defaultDialog;
      } else {
        dialog = `${npc.name}: 欢迎光临！有什么需要帮忙的吗？`;
      }

      // 检查NPC关联的任务，分为三类：
      // 1. availableQuests — 可接取的
      // 2. acceptedQuests — 已接取/进行中（显示进度）
      // 3. completableQuests — 已完成待交任务（显示完成按钮）
      const availableQuests = [];
      const acceptedQuests = [];
      const completableQuests = [];
      const npcQuestIds = npc.quests || [];

      for (const questId of npcQuestIds) {
        const questConfig = getQuest(questId);
        if (!questConfig) continue;

        // 检查是否已接取/进行中
        const existing = await Quest.findOne({ userId: user._id, questId, status: { $in: ['accepted', 'in_progress'] } });
        if (existing) {
          acceptedQuests.push({
            id: questConfig.id,
            name: questConfig.name,
            description: questConfig.description,
            type: questConfig.type,
            progress: existing.progress || {},
            status: existing.status
          });
          continue;
        }

        // 检查是否已完成但未领奖（可交任务）
        const completed = await Quest.findOne({ userId: user._id, questId, status: 'completed', rewardClaimed: false });
        if (completed) {
          completableQuests.push({
            id: questConfig.id,
            name: questConfig.name,
            description: questConfig.description,
            type: questConfig.type,
            rewards: questConfig.rewards
          });
          continue;
        }

        // 检查是否已彻底完成（已领奖，非重复任务）
        if (!questConfig.repeatable) {
          const done = await Quest.findOne({ userId: user._id, questId, status: 'completed', rewardClaimed: true });
          if (done) continue;
        }

        // 检查前置任务
        let prereqsMet = true;
        const missingPrereqNames = [];
        if (questConfig.prerequisites) {
          for (const prereq of questConfig.prerequisites) {
            const prereqDone = await Quest.findOne({ userId: user._id, questId: prereq, status: 'completed' });
            if (!prereqDone) {
              prereqsMet = false;
              const prereqConfig = getQuest(prereq);
              missingPrereqNames.push(prereqConfig?.name || prereq);
            }
          }
        }

        availableQuests.push({
          id: questConfig.id,
          name: questConfig.name,
          description: questConfig.description,
          type: questConfig.type,
          rewards: questConfig.rewards,
          prerequisitesMet: prereqsMet,
          missingPrereqs: prereqsMet ? null : missingPrereqNames
        });
      }

      // 如果NPC是门派招募者，检查入门考核
      if (npc.type === 'faction' && npc.factionId) {
        const faction = getFaction(npc.factionId);
        if (faction && faction.entryExamId && !user.faction) {
          const examQuest = getFactionQuest(faction.entryExamId);
          if (examQuest) {
            const examDone = await Quest.findOne({ userId: user._id, questId: faction.entryExamId, status: 'completed' });
            const examActive = await Quest.findOne({ userId: user._id, questId: faction.entryExamId, status: { $in: ['accepted', 'in_progress'] } });
            if (!examDone && !examActive) {
              availableQuests.push({
                id: examQuest.id,
                name: examQuest.name,
                description: examQuest.description,
                type: 'faction_entry',
                rewards: examQuest.rewards,
                prerequisitesMet: true
              });
            }
          }
        }
      }

      // 门派贡献兑换NPC
      let factionExchangeInfo = null;
      if (npc.type === 'faction_exchange' || npc.services?.includes('exchange')) {
        if (user.faction) {
          const faction = getFaction(user.faction);
          const exchangeSkills = getLearnableSkills(user.faction, user.level, user.factionRank)
            .filter(s => !user.skills.includes(s.id))
            .map(s => ({ ...s, contributionCost: s.learnPrice || 100 }));
          factionExchangeInfo = {
            factionId: user.faction,
            factionName: faction?.name || user.faction,
            myContribution: user.factionContribution,
            myRank: user.factionRank,
            skills: exchangeSkills
          };
        } else {
          factionExchangeInfo = { noFaction: true, message: '你需要先加入门派才能使用贡献兑换。' };
        }
      }

      // 返回NPC对话信息
      socket.emit('npc_dialog', {
        npc: {
          id: npc.id,
          name: npc.name,
          description: npc.description,
          type: npc.type,
          services: npc.services,
          items: npc.items,
          skills: npc.skills,
          quests: npc.quests
        },
        roomServices: room.services || [],
        message: dialog,
        availableQuests,
        acceptedQuests,
        completableQuests,
        factionExchangeInfo
      });

      // 任务进度：与NPC对话
      questProgressService.checkProgress(user._id, { type: 'talk', target: npcId }).catch(() => {});
      // 每日任务：对话
      dailyService.updateDailyTaskProgress(user._id, 'talk').catch(() => {});
    });
    
    // ==================== 打听消息 ====================

    socket.on('rumor', async () => {
      const room = getRoom(user.location.roomId);
      if (!room?.services?.includes('rumor')) {
        return socket.emit('error', { message: '这里没有可以打听消息的人' });
      }
      const npcs = getNpcsInRoom(room.id);
      const rumorNpc = npcs.find(n => n.services?.includes('rumor'));
      if (!rumorNpc) {
        return socket.emit('error', { message: '这里没有可以打听消息的人' });
      }

      // 智能谣言系统：结合NPC对话、任务进度、附近区域生成有用提示
      const rumorHints = [];
      // 1. NPC自带的谣言
      const npcRumor = rumorNpc.dialogues?.rumor;
      if (npcRumor) rumorHints.push(npcRumor);

      // 2. 当前已接任务的提示
      const activeQuests = await Quest.find({ userId: user._id, status: { $in: ['accepted', 'in_progress'] } });
      for (const q of activeQuests.slice(0, 2)) {
        const cfg = getQuest(q.questId);
        if (cfg?.hint) rumorHints.push(cfg.hint);
      }

      // 3. 附近探索提示 (随机一个有怪物的出口方向)
      if (rumorHints.length < 2 && room.exits?.length > 0) {
        const randomExit = room.exits[Math.floor(Math.random() * room.exits.length)];
        const exitRoom = getRoom(randomExit.roomId);
        if (exitRoom) {
          const hasMonsters = getMonstersInRoom(randomExit.roomId).length > 0;
          if (hasMonsters) {
            rumorHints.push(`${DIR_LABELS[randomExit.direction] || randomExit.direction}边的${exitRoom.name}有怪物出没，去那里练级不错。`);
          } else {
            rumorHints.push(`${DIR_LABELS[randomExit.direction] || randomExit.direction}边的${exitRoom.name}值得一探。`);
          }
        }
      }

      // 4. 通用游戏提示
      const generalTips = [
        '练武场的教头可以教你基础功夫。',
        '去铁匠铺买把趁手的武器，打怪更轻松。',
        '客栈休息可以恢复全部生命和内力。',
        '加入门派后可以在门派总部学习独门武功。',
        '功法书可以在背包中使用，有概率直接领悟技能。'
      ];
      if (rumorHints.length < 2) {
        rumorHints.push(generalTips[Math.floor(Math.random() * generalTips.length)]);
      }

      const rumorMsg = rumorHints.length > 0
        ? rumorHints[Math.floor(Math.random() * Math.min(2, rumorHints.length))]
        : '最近江湖上风平浪静...';

      socket.emit('system_message', { content: `💬 ${rumorNpc.name}悄悄告诉你：「${rumorMsg}」` });
      socket.emit('npc_dialog', {
        npc: { id: rumorNpc.id, name: rumorNpc.name, description: rumorNpc.description, type: rumorNpc.type, services: rumorNpc.services },
        roomServices: room.services || [],
        message: `${rumorNpc.name}: 「${rumorMsg}」`
      });
    });

    // ==================== 休息 ====================

    socket.on('rest', async () => {
      const room = getRoom(user.location.roomId);
      const isInn = room?.services?.includes('rest');

      // 从数据库重新加载最新HP/MP（战斗升级后可能已变化）
      const fresh = await User.findById(user._id, 'hp mp').lean();
      if (!fresh) return;
      const maxHp = fresh.hp?.max || user.hp.max;
      const maxMp = fresh.mp?.max || user.mp.max;
      const curHp = fresh.hp?.current ?? user.hp.current;
      const curMp = fresh.mp?.current ?? user.mp.current;

      let newHp, newMp;
      if (isInn) {
        newHp = maxHp;
        newMp = maxMp;
        socket.emit('system_message', { content: '你休息了一会儿，体力完全恢复了。' });
      } else {
        const hpRecover = Math.floor(maxHp * 0.5);
        const mpRecover = Math.floor(maxMp * 0.5);
        newHp = Math.min(curHp + hpRecover, maxHp);
        newMp = Math.min(curMp + mpRecover, maxMp);
        socket.emit('system_message', { content: `你在野外休息了一会儿，恢复了${hpRecover}点生命和${mpRecover}点内力。（客栈可完全恢复）` });
      }

      await User.findByIdAndUpdate(user._id, { $set: { 'hp.current': newHp, 'mp.current': newMp } });

      // 同步内存中的user对象
      user.hp.current = newHp;
      user.hp.max = maxHp;
      user.mp.current = newMp;
      user.mp.max = maxMp;

      socket.emit('rest_complete', {
        hp: { current: newHp, max: maxHp },
        mp: { current: newMp, max: maxMp },
        fullRecovery: isInn
      });
    });
    
    // ==================== 商店系统 ====================
    
    // 查看商店
    socket.on('shop_list', async () => {
      const room = getRoom(user.location.roomId);
      if (!roomSupportsShop(room)) {
        return socket.emit('error', { message: '这里没有商店' });
      }
      
      // 根据房间类型返回不同商品，附带库存和出售价信息
      const shopItems = getShopItems(resolveShopType(room)).map(item => ({
        ...item,
        stock: getShopStock(room.id, item.id),
        sellPrice: item.sellPrice || Math.floor((item.price || 0) * 0.4)
      }));
      socket.emit('shop_items', { items: shopItems, roomName: room.name });
    });
    
    // 购买物品
    socket.on('buy_item', async (data) => {
      const { itemId, quantity = 1 } = data;
      const room = getRoom(user.location.roomId);
      
      if (!roomSupportsShop(room)) {
        return socket.emit('error', { message: '这里没有商店' });
      }
      
      const availableItems = getShopItems(resolveShopType(room));
      // 支持物品ID、物品名称（中文/英文）匹配
      const item = availableItems.find(entry => 
        entry.id === itemId || 
        entry.name === itemId || 
        entry.id?.toLowerCase() === itemId?.toLowerCase()
      );
      if (!item) {
        return socket.emit('error', { message: '这个商店不出售该物品，可用 shop 查看商品列表' });
      }
      
      // 检查物品是否可售
      if (!item.price) {
        return socket.emit('error', { message: '此物品暂不出售' });
      }

      // 原子库存扣减（防止并发超卖）
      if (!tryDecrShopStock(room.id, item.id, quantity)) {
        return socket.emit('error', { message: `库存不足，仅剩 ${getShopStock(room.id, item.id)} 件` });
      }

      const totalPrice = (item.price || 0) * quantity;

      // 原子扣金币（防止并发）
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, gold: { $gte: totalPrice } },
        { $inc: { gold: -totalPrice } },
        { new: true }
      );
      if (!updatedUser) {
        // 金币不足，退回库存
        shopStocks.get(room.id)[item.id] += quantity;
        return socket.emit('error', { message: `金币不足，需要 ${totalPrice} 金币` });
      }
      user.gold = updatedUser.gold;

      // 添加到背包
      let inventoryItem = await Inventory.findOne({ userId: user._id, itemId });
      if (inventoryItem) {
        inventoryItem.quantity += quantity;
        await inventoryItem.save();
      } else {
        await Inventory.create({
          userId: user._id,
          itemId,
          quantity,
          isEquipped: false
        });
      }
      
      socket.emit('item_bought', {
        item,
        quantity,
        totalGold: user.gold
      });
      socket.emit('system_message', {
        content: `你购买了 ${quantity} 个 ${item.name}，花费 ${totalPrice} 金币`
      });
      actionLogService.log(user._id, user.characterName, 'economy', 'buy', { itemId, itemName: item.name, quantity, totalPrice }, user.location.roomId);

      // 任务进度：购买物品（使用实际物品ID而非用户输入名称）
      questProgressService.checkProgress(user._id, { type: 'buy', target: item.id }).catch(() => {});
    });
    
    // 出售物品
    socket.on('sell_item', async (data) => {
      const { itemId, quantity = 1 } = data;
      const room = getRoom(user.location.roomId);
      
      if (!roomSupportsShop(room)) {
        return socket.emit('error', { message: '这里没有商店' });
      }
      
      // 支持物品ID或名称查找
      let resolvedItemId = itemId;
      let inventoryItem = await Inventory.findOne({ userId: user._id, itemId });
      if (!inventoryItem) {
        // 尝试按名称查找背包中的物品
        const allInventory = await Inventory.find({ userId: user._id });
        const matched = allInventory.find(inv => {
          const itemConfig = getItem(inv.itemId);
          return itemConfig?.name === itemId;
        });
        if (matched) {
          inventoryItem = matched;
          resolvedItemId = matched.itemId;
        }
      }
      
      if (!inventoryItem || inventoryItem.quantity < quantity) {
        return socket.emit('error', { message: '物品数量不足' });
      }
      
      const item = getItem(resolvedItemId);
      if (!item) {
        return socket.emit('error', { message: '物品不存在' });
      }
      
      const sellPrice = Math.floor((item.price || 0) * 0.5 * quantity);
      
      // 扣除物品
      inventoryItem.quantity -= quantity;
      if (inventoryItem.quantity <= 0) {
        await Inventory.deleteOne({ _id: inventoryItem._id });
      } else {
        await inventoryItem.save();
      }
      
      // 增加金币
      user.gold += sellPrice;
      await user.save();
      
      socket.emit('item_sold', {
        item,
        quantity,
        totalGold: user.gold
      });
      socket.emit('system_message', {
        content: `你出售了 ${quantity} 个 ${item.name}，获得 ${sellPrice} 金币`
      });
      actionLogService.log(user._id, user.characterName, 'economy', 'sell', { itemId, itemName: item.name, quantity, sellPrice }, user.location.roomId);
    });
    
    // 修复装备
    socket.on('repair_item', async (data) => {
      const { inventoryId } = data;
      const room = getRoom(user.location.roomId);
      
      // 铁匠铺才能修复
      if (!room?.services?.includes('blacksmith') && !room?.services?.includes('repair')) {
        return socket.emit('error', { message: '这里没有铁匠铺，无法修复装备' });
      }
      
      const inventoryItem = await Inventory.findOne({ _id: inventoryId, userId: user._id });
      if (!inventoryItem) {
        return socket.emit('error', { message: '物品不存在' });
      }
      
      const itemConfig = inventoryItem.getItemConfig();
      if (!itemConfig || (itemConfig.type !== 'weapon' && itemConfig.type !== 'armor')) {
        return socket.emit('error', { message: '只能修复武器和防具' });
      }
      
      if (inventoryItem.durability.current >= inventoryItem.durability.max) {
        return socket.emit('error', { message: '该装备耐久已满，无需修复' });
      }
      
      // 修复费用：每点耐久1金币
      const durabilityLoss = inventoryItem.durability.max - inventoryItem.durability.current;
      const repairCost = durabilityLoss;
      
      if (user.gold < repairCost) {
        return socket.emit('error', { message: `金币不足，需要 ${repairCost} 金币修复` });
      }
      
      user.gold -= repairCost;
      inventoryItem.repair(durabilityLoss);
      
      await user.save();
      await inventoryItem.save();
      
      socket.emit('item_repaired', {
        inventoryId,
        itemId: inventoryItem.itemId,
        durability: inventoryItem.durability,
        repairCost
      });
      socket.emit('system_message', {
        content: `你修复了 ${itemConfig.name}，花费 ${repairCost} 金币，耐久恢复满`
      });
    });
    
    // 修复全部装备
    socket.on('repair_all', async () => {
      const room = getRoom(user.location.roomId);
      
      if (!room?.services?.includes('blacksmith') && !room?.services?.includes('repair')) {
        return socket.emit('error', { message: '这里没有铁匠铺，无法修复装备' });
      }
      
      const equippedItems = await Inventory.find({ userId: user._id, isEquipped: true });
      let totalCost = 0;
      const repairedItems = [];
      
      for (const item of equippedItems) {
        const loss = item.durability.max - item.durability.current;
        if (loss > 0) {
          totalCost += loss;
          item.repair(loss);
          repairedItems.push({ itemId: item.itemId, durability: item.durability });
          await item.save();
        }
      }
      
      if (totalCost === 0) {
        return socket.emit('error', { message: '所有装备耐久已满' });
      }
      
      if (user.gold < totalCost) {
        return socket.emit('error', { message: `金币不足，需要 ${totalCost} 金币修复全部装备` });
      }
      
      user.gold -= totalCost;
      await user.save();
      
      socket.emit('items_repaired', {
        repairedItems,
        totalCost
      });
      socket.emit('system_message', {
        content: `你修复了 ${repairedItems.length} 件装备，花费 ${totalCost} 金币`
      });
    });
    
    // ==================== 技能系统 ====================
    
    // 学习技能
    socket.on('learn_skill', async (data) => {
      const { skillId } = data;
      const room = getRoom(user.location.roomId);
      
      if (!roomSupportsSkillLearning(room)) {
        return socket.emit('error', { message: '这里不能学习技能' });
      }
      
      const skill = getSkill(skillId);
      if (!skill) {
        return socket.emit('error', { message: '技能不存在' });
      }
      
      // 检查等级
      if (skill.requireLevel && user.level < skill.requireLevel) {
        return socket.emit('error', { message: `需要等级 ${skill.requireLevel} 才能学习此技能` });
      }
      
      // 检查门派
      if (skill.faction === 'monster') {
        return socket.emit('error', { message: '无法学习怪物技能' });
      }

      if (skill.faction && skill.faction !== 'general' && skill.faction !== user.faction) {
        return socket.emit('error', { message: '此技能需要加入对应门派才能学习' });
      }
      
      // 检查是否已学习
      const existingSkill = await CharacterSkill.findOne({ userId: user._id, skillId });
      if (existingSkill) {
        return socket.emit('error', { message: '你已经学会了这个技能' });
      }
      
      // 扣除金币
      const learnPrice = skill.learnPrice || skill.learnCost || 0;
      if (user.gold < learnPrice) {
        return socket.emit('error', { message: `金币不足，需要 ${learnPrice} 金币` });
      }
      
      user.gold -= learnPrice;
      await user.save();
      
      // 添加技能
      await CharacterSkill.create({
        userId: user._id,
        skillId,
        level: 1,
        proficiency: 0,
        learned: true
      });
      
      socket.emit('skill_learned', {
        skill,
        remainingGold: user.gold
      });
      socket.emit('system_message', {
        content: `你学会了「${skill.name}」！`
      });
      actionLogService.log(user._id, user.characterName, 'skill', 'learn', { skillId, skillName: skill.name, goldCost: learnPrice }, user.location.roomId);

      // 任务进度：学习技能
      questProgressService.checkProgress(user._id, { type: 'learn_skill', target: skillId, skillRequireLevel: skill.requireLevel || 1 }).catch(() => {});
    });
    
    // 查看可学习技能
    socket.on('list_learnable_skills', async () => {
      const room = getRoom(user.location.roomId);
      
      if (!roomSupportsSkillLearning(room)) {
        return socket.emit('error', { message: '这里不能学习技能' });
      }
      
      const skills = getLearnableSkills(user.faction, user.level, user.factionRank);
      
      // 过滤已学习的
      const learnedSkills = await CharacterSkill.find({ userId: user._id });
      const learnedIds = learnedSkills.map(s => s.skillId);
      const availableSkills = skills.filter(s => !learnedIds.includes(s.id));
      
      socket.emit('learnable_skills', { skills: availableSkills });
    });
    
    // ==================== 属性训练 ====================
    
    // 训练属性
    socket.on('train_stat', async (data) => {
      const { stat } = data;
      const room = getRoom(user.location.roomId);

      if (!room?.services?.includes('train')) {
        return socket.emit('error', { message: '这里不能训练' });
      }

      const normalizedStat = normalizeStatName(stat);
      if (!normalizedStat) {
        return socket.emit('error', { message: '无效的属性。用法: train <属性>\n可用属性: 力量/strength, 敏捷/dexterity, 体质/constitution, 悟性/intelligence, 根骨/charisma\n示例: train strength' });
      }
      
      const currentValue = user.attributes?.[normalizedStat] || 10;
      const expCost = currentValue * 100;
      const goldCost = currentValue * 10;
      
      if (user.exp < expCost) {
        return socket.emit('error', { message: `经验不足，需要 ${expCost} 经验` });
      }
      
      if (user.gold < goldCost) {
        return socket.emit('error', { message: `金币不足，需要 ${goldCost} 金币` });
      }
      
      // 扣除消耗
      user.exp -= expCost;
      user.gold -= goldCost;
      
      // 提升属性
      user.attributes[normalizedStat] = currentValue + 1;
      
      // 重新计算战斗属性
      recalculateStats(user);
      
      await user.save();
      
      socket.emit('stat_trained', {
        stat: normalizedStat,
        newValue: user.attributes[normalizedStat],
        attributes: user.attributes,
        freePoints: user.freePoints,
        hp: user.hp,
        mp: user.mp,
        exp: user.exp,
        gold: user.gold
      });
      socket.emit('system_message', {
        content: `你的${getStatName(normalizedStat)}提升了！现在是 ${user.attributes[normalizedStat]}`
      });

      // 任务进度：训练属性
      questProgressService.checkProgress(user._id, { type: 'train' }).catch(() => {});
    });
    
    // 分配自由属性点
    socket.on('allocate_points', async (data) => {
      const { stat, points = 1 } = data;
      
      const normalizedStat = normalizeStatName(stat);
      if (!normalizedStat) {
        return socket.emit('error', { message: '无效的属性。用法: train <属性>\n可用属性: 力量/strength, 敏捷/dexterity, 体质/constitution, 悟性/intelligence, 根骨/charisma\n示例: train strength' });
      }
      
      if (user.freePoints < points) {
        return socket.emit('error', { message: `自由属性点不足，当前有 ${user.freePoints} 点` });
      }
      
      user.attributes[normalizedStat] = (user.attributes[normalizedStat] || 10) + points;
      user.freePoints -= points;
      
      recalculateStats(user);
      await user.save();
      
      socket.emit('points_allocated', {
        stat: normalizedStat,
        statName: getStatName(normalizedStat),
        pointsAllocated: points,
        newValue: user.attributes[normalizedStat],
        freePoints: user.freePoints,
        hp: user.hp,
        mp: user.mp
      });
      socket.emit('system_message', {
        content: `分配了 ${points} 点到${getStatName(normalizedStat)}，现在是 ${user.attributes[normalizedStat]}（剩余 ${user.freePoints} 点）`
      });
    });
    
    // ==================== 断开连接 ====================
    
    socket.on('disconnect', async () => {
      console.log(`[Socket] 用户断开: ${user.characterName} (${socket.id})`);

      clearInterval(naturalRegenInterval);

      // 从在线列表移除
      onlinePlayers.delete(socket.id);
      authUnregisterSocket(user._id, socket.id);
      
      // 从房间移除
      const roomId = user.location.roomId;
      removeFromRoom(roomId, socket.id);
      io.to(`room:${roomId}`).emit('player_left', {
        name: user.characterName
      });
      // 通知房间剩余玩家刷新
      io.to(`room:${roomId}`).emit('room_info', getRoomDescription(roomId));
      
      // 更新状态
      user.status = 'offline';
      await user.save();
      
      // 如果在战斗中，处理不同情况
      const battleId = battleService.isInBattle(user._id);
      if (battleId) {
        const battle = battleService.getBattle(battleId);
        if (battle && battle.status === 'active') {
          if (battle.type === 'pvp') {
            // PvP战斗：启动掉线保护，给对方30秒宽限期
            battleService.startDisconnectProtection(battleId, user._id);
            const opponent = battle.participants.find(
              p => p.userId?.toString() !== user._id.toString()
            );
            const battleRoom = `battle:${battleId}`;
            io.to(battleRoom).emit('system_message', {
              content: `⚠️ ${user.characterName} 已断开连接，${PVP_DISCONNECT_GRACE_SECONDS}秒内重连可恢复战斗，否则判负`
            });
            console.log(`[Battle] PvP掉线保护: ${user.characterName} → ${battleId}, 宽限期${PVP_DISCONNECT_GRACE_SECONDS}秒`);
          } else {
            // PvE战斗：直接逃跑
            const playerIdx = battle.turnOrder.findIndex(
              p => p.userId?.toString() === user._id.toString()
            );
            if (playerIdx >= 0) {
              battle.currentTurn = playerIdx;
            }
            try {
              const turnResult = await battleService.executeTurn(battleId, 'flee');
              io.to(`battle:${battleId}`).emit('battle_ended', turnResult);
              io.in(`battle:${battleId}`).socketsLeave(`battle:${battleId}`);
            } catch (err) {
              // 逃跑失败，强制结束
              battleService.forceEndBattle(battleId, 'disconnect');
            }
          }
        }
      }
    });
  });
}

// 成就检查辅助
async function checkAndAwardAchievements(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    if (!user.stats) {
      user.stats = { battlesWon: 0, pvpBattles: 0, tradesCompleted: 0, goldEarned: 0, roomsVisited: [], questsCompleted: 0, deaths: 0 };
    }
    const stats = {
      battles: user.stats.battlesWon || 0,
      pvpBattles: user.stats.pvpBattles || 0,
      trades: user.stats.tradesCompleted || 0,
      goldEarned: user.stats.goldEarned || 0,
      roomsVisited: user.stats.roomsVisited?.length || 0,
      questsCompleted: user.stats.questsCompleted || 0,
      level: user.level || 1,
      faction: user.faction,
      factionRank: user.factionRank,
      deaths: user.stats.deaths || 0,
      dungeonsCompleted: user.stats.dungeonsCompleted || 0,
      craftingCount: user.stats.craftingCount || 0,
      checkinStreak: user.stats.checkinStreak || 0,
      gangJoined: user.stats.gangJoined || false
    };
    const newAchievements = await achievementService.checkAllAchievements(user._id, stats);
    if (newAchievements.length === 0) return;
    for (const ach of newAchievements) {
      if (ach.rewards?.exp) user.exp += ach.rewards.exp;
      if (ach.rewards?.gold) {
        user.gold += ach.rewards.gold;
        user.stats.goldEarned += ach.rewards.gold;
      }
      if (ach.rewards?.title) user.title = ach.rewards.title;
    }
    await user.save();
    const sock = findSocketByUserId(userId.toString());
    if (sock) {
      newAchievements.forEach(ach => {
        sock.emit('achievement_unlocked', {
          id: ach.achievementId,
          name: ach.name,
          description: ach.description,
          rewards: ach.rewards
        });
      });
    }
  } catch (err) {
    console.error('[Achievement] check failed:', err.message);
  }
}

// 获取房间描述
function getRoomDescription(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;

  const players = getPlayersInRoom(roomId);
  const npcs = getNpcsInRoom(roomId);
  const monsters = getMonstersInRoom(roomId);
  const exits = getRoomExits(roomId).map(e => ({
    ...e,
    label: DIR_LABELS[e.direction] || e.direction
  }));

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    services: room.services?.map(s => SERVICE_LABELS[s] || s) || [],
    exits,
    players: players.map(p => ({ name: p.name, level: p.level })),
    npcs: npcs.map(n => ({ id: n.id, name: n.name, type: n.type, factionId: n.factionId })),
    monsters: monsters.map(m => ({ id: m.id, name: m.name, level: m.level }))
  };
}

// 添加玩家到房间
function addToRoom(roomId, socketId, user) {
  if (!roomPlayers.has(roomId)) {
    roomPlayers.set(roomId, new Map());
  }
  roomPlayers.get(roomId).set(socketId, {
    userId: user._id,
    name: user.characterName,
    level: user.level
  });
}

// 从房间移除玩家
function removeFromRoom(roomId, socketId) {
  if (roomPlayers.has(roomId)) {
    roomPlayers.get(roomId).delete(socketId);
  }
}

// 获取房间内玩家
function getPlayersInRoom(roomId) {
  if (!roomPlayers.has(roomId)) return [];
  return Array.from(roomPlayers.get(roomId).values());
}

// 根据用户ID查找Socket（使用auth模块追踪）
function findSocketByUserId(userId) {
  const socketId = authFindSocket(userId);
  if (socketId) {
    const sock = socketServer?.sockets?.sockets?.get(socketId);
    if (sock) return sock;
  }
  // 回退：遍历查找
  for (const [sid, player] of onlinePlayers) {
    if (player.userId.toString() === userId.toString()) {
      return socketServer?.sockets?.sockets?.get(sid);
    }
  }
  return null;
}

function roomSupportsShop(room) {
  if (!room?.services) return false;
  return room.services.some(service => ['shop', 'buy_item', 'buy_weapon', 'buy_armor', 'sell_item'].includes(service));
}

function roomSupportsSkillLearning(room) {
  if (!room?.services) return false;
  return room.services.some(service => ['train', 'learn_skill'].includes(service));
}

function resolveShopType(room) {
  if (room?.shopType) return room.shopType;
  if (room?.services?.includes('buy_weapon') || room?.services?.includes('forge_weapon')) {
    return 'weapon';
  }
  if (room?.services?.includes('buy_armor')) {
    return 'armor';
  }
  return 'general';
}

function isEquipmentItem(item) {
  return item?.type === 'weapon' || item?.type === 'armor' || item?.type === 'equipment';
}

function getEquipmentSlot(item) {
  if (!item) return null;
  if (item.type === 'weapon') return 'weapon';
  // equipment 类型使用其 equipSlot 字段
  if (item.type === 'equipment') return item.equipSlot || 'armor';
  if (item.type !== 'armor') return null;

  switch (item.subtype) {
    case 'body':
      return 'armor';
    case 'helmet':
      return 'helmet';
    case 'boots':
      return 'boots';
    case 'ring':
      return 'ring';
    case 'accessory':
      return 'accessory';
    default:
      return 'armor';
  }
}

// 获取商店物品
function getShopItems(shopType) {
  const { items } = require('../game');
  const allItems = items();
  
  // 根据商店类型过滤
  switch (shopType) {
    case 'weapon':
      return allItems.filter(i => i.type === 'weapon');
    case 'armor':
      return allItems.filter(i => i.type === 'armor');
    case 'equipment':
      return allItems.filter(i => i.type === 'weapon' || i.type === 'armor');
    case 'potion':
      return allItems.filter(i => i.type === 'consumable');
    case 'general':
      return allItems.filter(i => ['consumable', 'material', 'weapon', 'armor'].includes(i.type));
    default:
      return allItems;
  }
}

// 属性名称映射
function getStatName(stat) {
  const names = {
    strength: '力量',
    dexterity: '敏捷',
    constitution: '体质',
    intelligence: '悟性',
    charisma: '根骨'
  };
  return names[stat] || stat;
}

// 属性名称反向映射（支持中文和英文输入）
function normalizeStatName(input) {
  const map = {
    '力量': 'strength',
    '敏捷': 'dexterity',
    '体质': 'constitution',
    '悟性': 'intelligence',
    '根骨': 'charisma',
    'strength': 'strength',
    'dexterity': 'dexterity',
    'constitution': 'constitution',
    'intelligence': 'intelligence',
    'charisma': 'charisma'
  };
  return map[input] || null;
}

// 重新计算战斗属性
function recalculateStats(user) {
  user.hp.max = user.calculateMaxHP();
  user.hp.current = Math.min(user.hp.current, user.hp.max);
  
  user.mp.max = user.calculateMaxMP();
  user.mp.current = Math.min(user.mp.current, user.mp.max);
}

// 转移物品（交易用）
async function transferItem(fromUserId, toUserId, itemId, quantity) {
  // 从发起方背包减少
  const fromItem = await Inventory.findOne({ userId: fromUserId, itemId });
  if (!fromItem) return;
  
  if (fromItem.quantity <= quantity) {
    await Inventory.deleteOne({ _id: fromItem._id });
  } else {
    fromItem.quantity -= quantity;
    await fromItem.save();
  }
  
  // 给接收方增加
  const toItem = await Inventory.findOne({ userId: toUserId, itemId });
  if (toItem) {
    toItem.quantity += quantity;
    await toItem.save();
  } else {
    const itemConfig = getItem(itemId);
    await Inventory.create({
      userId: toUserId,
      itemId,
      name: itemConfig?.name || itemId,
      type: itemConfig?.type || 'misc',
      quantity,
      durability: itemConfig?.durability ? { current: itemConfig.durability, max: itemConfig.durability } : undefined
    });
  }
}

module.exports = socketHandler;
