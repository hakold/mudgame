const { User, CharacterSkill, Inventory, Quest, ChatMessage, BattleLog } = require('../models');
const { socketAuthMiddleware } = require('../middleware/auth');
const { getRoom, getRoomExits, getNpcsInRoom, getMonstersInRoom, getSkill, getQuest, getItem, getFaction, getAllFactions, getLearnableSkills } = require('../game');
const BattleService = require('../game/battleService');
const questProgressService = require('../game/questProgressService');
const roomDropsService = require('../game/roomDropsService');

// 在线玩家映射
const onlinePlayers = new Map();

// 房间内玩家映射
const roomPlayers = new Map();

let socketServer = null;

function socketHandler(io) {
  socketServer = io;

  // 认证中间件
  io.use(socketAuthMiddleware);
  
  // 创建战斗服务
  const battleService = new BattleService(io);

  // 初始化任务进度服务
  questProgressService.init(io);
  
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[Socket] 用户连接: ${user.characterName} (${socket.id})`);
    
    // 加入在线列表
    onlinePlayers.set(socket.id, {
      userId: user._id,
      name: user.characterName,
      level: user.level,
      location: user.location,
      socketId: socket.id
    });
    
    // 加入房间频道
    const roomId = user.location.roomId;
    socket.join(`room:${roomId}`);
    addToRoom(roomId, socket.id, user);
    
    // 更新用户状态
    user.status = 'online';
    await user.save();
    
    // 发送欢迎消息
    socket.emit('welcome', {
      message: `欢迎来到侠客行，${user.characterName}！`,
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
    
    // ==================== 房间相关 ====================
    
    // 查看房间
    socket.on('look', async () => {
      const roomId = user.location.roomId;
      const roomDesc = getRoomDescription(roomId);
      roomDesc.drops = roomDropsService.getDrops(roomId);
      socket.emit('room_info', roomDesc);
    });
    
    // 移动
    socket.on('move', async (data) => {
      const { direction } = data;
      const currentRoom = getRoom(user.location.roomId);
      
      if (!currentRoom) {
        return socket.emit('error', { message: '当前位置无效' });
      }
      
      const exit = currentRoom.exits?.find(e => e.direction === direction);
      if (!exit) {
        return socket.emit('error', { message: '该方向没有出口' });
      }
      
      // 离开当前房间
      socket.leave(`room:${user.location.roomId}`);
      removeFromRoom(user.location.roomId, socket.id);
      io.to(`room:${user.location.roomId}`).emit('player_left', {
        name: user.characterName
      });
      
      // 进入新房间
      user.location.roomId = exit.roomId;
      await user.save();
      
      socket.join(`room:${exit.roomId}`);
      addToRoom(exit.roomId, socket.id, user);
      
      io.to(`room:${exit.roomId}`).emit('player_entered', {
        name: user.characterName,
        level: user.level
      });
      
      socket.emit('room_info', getRoomDescription(exit.roomId));

      // 通知新房间地面掉落
      const newRoomDrops = roomDropsService.getDrops(exit.roomId);
      if (newRoomDrops.length > 0) {
        socket.emit('room_drops', { drops: newRoomDrops, roomId: exit.roomId });
      }

      // 任务进度：到达房间
      questProgressService.checkProgress(user._id, { type: 'visit', target: exit.roomId });
    });
    
    // ==================== 战斗相关 ====================
    
    // 开始战斗
    socket.on('battle_start', async (data) => {
      const { targetId, type } = data;
      
      try {
        const battle = await battleService.startBattle(user._id, targetId, type || 'pve');
        socket.join(`battle:${battle.battleId}`);
        socket.emit('battle_started', battle);
        
        // 如果是PVP，通知对手
        if (type === 'pvp') {
          const opponentSocket = findSocketByUserId(targetId);
          if (opponentSocket) {
            opponentSocket.join(`battle:${battle.battleId}`);
            opponentSocket.emit('battle_started', battle);
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

        let turnResult = await battleService.executeTurn(battleId, action, skillId);
        io.to(roomName).emit('battle_update', turnResult);

        while (turnResult.battle.status === 'active') {
          const nextActor = battleService.getCurrentParticipant(battleId);
          if (!nextActor?.isMonster) {
            break;
          }

          const monsterAction = battleService.chooseAutomatedAction(battleId);
          turnResult = await battleService.executeTurn(
            battleId,
            monsterAction.action,
            monsterAction.skillId
          );
          io.to(roomName).emit('battle_update', turnResult);
        }

        if (turnResult.battle.status === 'ended' || turnResult.battle.status === 'fled') {
          io.to(roomName).emit('battle_ended', turnResult);

          // 任务进度：击杀怪物
          if (turnResult.battle.status === 'ended' && turnResult.battle.winner?.userId) {
            const monsterId = battle.monster?.id;
            if (monsterId) {
              questProgressService.checkProgress(user._id, { type: 'kill', target: monsterId });
            }
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
      if (user.status !== 'dead') {
        return socket.emit('error', { message: '你还没有死亡' });
      }
      
      user.revive();
      await user.save();
      
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
      questProgressService.checkProgress(user._id, { type: 'collect', target: pickedUp.itemId });
    });
    
    // 使用物品
    socket.on('use_item', async (data) => {
      const { inventoryId } = data;
      
      const item = await Inventory.findOne({ _id: inventoryId, userId: user._id });
      if (!item) {
        return socket.emit('error', { message: '物品不存在' });
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
    
    // 接取任务
    socket.on('accept_quest', async (data) => {
      const { questId } = data;
      const questConfig = getQuest(questId);
      
      if (!questConfig) {
        return socket.emit('error', { message: '任务不存在' });
      }
      
      // 检查是否已接取
      const existing = await Quest.findOne({ userId: user._id, questId });
      if (existing) {
        return socket.emit('error', { message: '已接取此任务' });
      }
      
      // 检查前置任务
      if (questConfig.prerequisites) {
        for (const prereq of questConfig.prerequisites) {
          const prereqQuest = await Quest.findOne({
            userId: user._id,
            questId: prereq,
            status: 'completed'
          });
          if (!prereqQuest) {
            return socket.emit('error', { message: '需要先完成前置任务' });
          }
        }
      }
      
      const newQuest = new Quest({
        userId: user._id,
        questId,
        status: 'accepted'
      });
      await newQuest.save();
      
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
      
      const questConfig = getQuest(questId);
      
      // 发放奖励
      const rewards = questConfig.rewards;
      if (rewards) {
        if (rewards.exp) user.exp += rewards.exp;
        if (rewards.gold) user.gold += rewards.gold;
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
    });
    
    // ==================== 聊天相关 ====================
    
    // ==================== 战斗日志 ====================
    
    // 查询战斗历史
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
      const { targetId, content } = data;
      
      const target = await User.findById(targetId);
      if (!target) {
        return socket.emit('error', { message: '目标玩家不存在' });
      }
      
      const message = new ChatMessage({
        channel: 'private',
        senderId: user._id,
        senderName: user.characterName,
        receiverId: targetId,
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
      const targetSocket = findSocketByUserId(targetId);
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
      
      user.faction = factionId;
      user.factionReputation = 0;
      user.factionContribution = 0;
      user.factionRank = 'disciple';
      await user.save();
      
      socket.emit('faction_joined', {
        faction,
        learnableSkills: getLearnableSkills(factionId, user.level, user.factionRank)
      });
      
      // 广播
      io.emit('system_message', {
        content: `${user.characterName} 加入了 ${faction.name}！`
      });
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
      
      // 获取NPC对话
      const dialog = npc.dialogues?.greeting || `${npc.name}: 欢迎光临！有什么需要帮忙的吗？`;
      
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
        message: dialog
      });

      // 任务进度：与NPC对话
      questProgressService.checkProgress(user._id, { type: 'talk', target: npcId });
    });
    
    // ==================== 休息 ====================
    
    socket.on('rest', async () => {
      const room = getRoom(user.location.roomId);
      
      // 检查是否在客栈或有休息服务
      if (!room?.services?.includes('rest')) {
        return socket.emit('error', { message: '这里不能休息，请到客栈休息' });
      }
      
      // 恢复HP和MP
      user.hp.current = user.hp.max;
      user.mp.current = user.mp.max;
      await user.save();
      
      socket.emit('rest_complete', {
        hp: user.hp,
        mp: user.mp
      });
      socket.emit('system_message', { content: '你休息了一会儿，体力完全恢复了。' });
    });
    
    // ==================== 商店系统 ====================
    
    // 查看商店
    socket.on('shop_list', async () => {
      const room = getRoom(user.location.roomId);
      if (!roomSupportsShop(room)) {
        return socket.emit('error', { message: '这里没有商店' });
      }
      
      // 根据房间类型返回不同商品
      const shopItems = getShopItems(resolveShopType(room));
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
      const item = availableItems.find(entry => entry.id === itemId);
      if (!item) {
        return socket.emit('error', { message: '这个商店不出售该物品' });
      }
      
      const totalPrice = (item.price || 0) * quantity;
      if (user.gold < totalPrice) {
        return socket.emit('error', { message: `金币不足，需要 ${totalPrice} 金币` });
      }
      
      // 扣除金币
      user.gold -= totalPrice;
      
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
      
      await user.save();
      
      socket.emit('item_bought', {
        item,
        quantity,
        totalGold: user.gold
      });
      socket.emit('system_message', {
        content: `你购买了 ${quantity} 个 ${item.name}，花费 ${totalPrice} 金币`
      });

      // 任务进度：购买物品
      questProgressService.checkProgress(user._id, { type: 'buy', target: itemId });
    });
    
    // 出售物品
    socket.on('sell_item', async (data) => {
      const { itemId, quantity = 1 } = data;
      const room = getRoom(user.location.roomId);
      
      if (!roomSupportsShop(room)) {
        return socket.emit('error', { message: '这里没有商店' });
      }
      
      const inventoryItem = await Inventory.findOne({ userId: user._id, itemId });
      if (!inventoryItem || inventoryItem.quantity < quantity) {
        return socket.emit('error', { message: '物品数量不足' });
      }
      
      const item = getItem(itemId);
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

      // 任务进度：学习技能
      questProgressService.checkProgress(user._id, { type: 'learn_skill', target: skillId, skillRequireLevel: skill.requireLevel || 1 });
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
        return socket.emit('error', { message: '无效的属性，可用: 力量/strength, 敏捷/dexterity, 体质/constitution, 悟性/intelligence' });
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
      questProgressService.checkProgress(user._id, { type: 'train' });
    });
    
    // 分配自由属性点
    socket.on('allocate_points', async (data) => {
      const { stat, points = 1 } = data;
      
      const normalizedStat = normalizeStatName(stat);
      if (!normalizedStat) {
        return socket.emit('error', { message: '无效的属性，可用: 力量/strength, 敏捷/dexterity, 体质/constitution, 悟性/intelligence' });
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
      
      // 从在线列表移除
      onlinePlayers.delete(socket.id);
      
      // 从房间移除
      const roomId = user.location.roomId;
      removeFromRoom(roomId, socket.id);
      io.to(`room:${roomId}`).emit('player_left', {
        name: user.characterName
      });
      
      // 更新状态
      user.status = 'offline';
      await user.save();
      
      // 如果在战斗中，处理战斗
      const battleId = battleService.isInBattle(user._id);
      if (battleId) {
        // 断线视为逃跑
        await battleService.executeTurn(battleId, 'flee');
      }
    });
  });
}

// 获取房间描述
function getRoomDescription(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  
  const players = getPlayersInRoom(roomId);
  const npcs = getNpcsInRoom(roomId);
  const monsters = getMonstersInRoom(roomId);
  const exits = getRoomExits(roomId);
  
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    services: room.services || [],
    exits,
    players: players.map(p => ({ name: p.name, level: p.level })),
    npcs: npcs.map(n => ({ id: n.id, name: n.name })),
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

// 根据用户ID查找Socket
function findSocketByUserId(userId) {
  for (const [socketId, player] of onlinePlayers) {
    if (player.userId.toString() === userId.toString()) {
      return socketServer?.sockets?.sockets?.get(socketId);
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
  return item?.type === 'weapon' || item?.type === 'armor';
}

function getEquipmentSlot(item) {
  if (!item) return null;
  if (item.type === 'weapon') return 'weapon';
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
    intelligence: '悟性'
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
    'strength': 'strength',
    'dexterity': 'dexterity',
    'constitution': 'constitution',
    'intelligence': 'intelligence'
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

module.exports = socketHandler;
