# Socket.IO 事件协议

## 认证与连接

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `connection` | C→S | JWT token (middleware) | 连接时自动认证 |
| `welcome` | S→C | `{ message, player, room }` | 连接成功欢迎 |
| `disconnect` | C→S | - | 断开连接 |

## 房间与移动

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `look` | C→S | - | 查看当前房间 |
| `room_info` | S→C | `{ name, description, exits, npcs, monsters, drops, services }` | 房间信息 |
| `move` | C→S | `{ direction }` | 移动到相邻房间 |
| `player_entered` | S→C | `{ name, level }` | 其他玩家进入房间 |
| `player_left` | S→C | `{ name }` | 其他玩家离开房间 |
| `room_drops` | S→C | `{ drops, roomId }` | 房间地面物品 |
| `room_drops_updated` | S→C | `{ drops, message }` | 地面物品更新通知 |

## 战斗

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `battle_start` | C→S | `{ monsterId }` | 发起战斗 |
| `battle_action` | C→S | `{ battleId, action, skillId }` | 战斗行动 |
| `battle_update` | S→C | `{ battle, round, effectMessages }` | 回合结果 |
| `battle_ended` | S→C | `{ battle, rewards, deathPenalty, skillExp }` | 战斗结束 |
| `get_battle_logs` | C→S | `{ limit, offset }` | 查询战斗历史 |
| `battle_logs` | S→C | `{ logs, total, offset, limit }` | 战斗日志列表 |
| `get_battle_detail` | C→S | `{ battleId }` | 查询战斗详情 |
| `battle_detail` | S→C | BattleLog对象 | 战斗详情 |

## NPC与对话

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `talk_npc` | C→S | `{ npcId }` | 与NPC对话 |
| `npc_dialog` | S→C | `{ npc, message, roomServices }` | NPC对话内容 |

## 商店

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `shop_list` | C→S | - | 查看商店 |
| `shop_items` | S→C | `{ items, roomName }` | 商店物品列表 |
| `buy_item` | C→S | `{ itemId, quantity }` | 购买物品 |
| `item_bought` | S→C | `{ item, quantity, totalGold }` | 购买成功 |
| `sell_item` | C→S | `{ inventoryId, quantity }` | 出售物品 |
| `item_sold` | S→C | `{ item, quantity, totalGold }` | 出售成功 |

## 物品与装备

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `use_item` | C→S | `{ inventoryId }` | 使用/装备物品 |
| `item_used` | S→C | `{ item, hp, mp }` | 使用物品结果 |
| `item_equipped` | S→C | `{ item, slot }` | 装备成功 |
| `unequip_item` | C→S | `{ inventoryId }` | 卸下装备 |
| `item_unequipped` | S→C | `{ item, slot }` | 卸下成功 |
| `pickup_item` | C→S | `{ itemId, quantity }` | 拾取地面物品 |
| `item_picked_up` | S→C | `{ itemId, name, quantity }` | 拾取成功 |
| `look_drops` | C→S | - | 查看地面掉落 |
| `repair_item` | C→S | `{ inventoryId }` | 修复单件装备 |
| `item_repaired` | S→C | `{ inventoryId, itemId, durability, repairCost }` | 修复成功 |
| `repair_all` | C→S | - | 修复全部装备 |
| `items_repaired` | S→C | `{ repairedItems, totalCost }` | 全部修复成功 |

## 技能

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `learn_skill` | C→S | `{ skillId }` | 学习技能 |
| `skill_learned` | S→C | `{ skill, mpCost }` | 学习成功 |
| `skills_list` | C→S | `{ factionId }` | 查看可学技能 |

## 属性与训练

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `train_stat` | C→S | `{ stat }` | 训练属性（消耗经验金币） |
| `stat_trained` | S→C | `{ stat, newValue, expCost, goldCost }` | 训练成功 |
| `allocate_points` | C→S | `{ stat, points }` | 分配自由属性点 |
| `points_allocated` | S→C | `{ stat, newValue, freePoints, hp, mp }` | 分配成功 |

## 门派

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `list_factions` | C→S | - | 查看门派列表 |
| `factions_list` | S→C | Faction数组 | 门派列表 |
| `join_faction` | C→S | `{ factionId }` | 加入门派 |
| `faction_joined` | S→C | `{ faction, learnableSkills }` | 加入成功 |
| `leave_faction` | C→S | - | 退出门派 |
| `faction_left` | S→C | `{ factionName, message }` | 退出成功 |
| `faction_advance` | C→S | - | 门派进阶 |
| `faction_advanced` | S→C | `{ oldRank, newRank, freePoints }` | 进阶成功 |
| `faction_task` | C→S | - | 门派任务（捐献） |
| `faction_task_completed` | S→C | `{ goldDonated, reputationGained, totalReputation }` | 任务完成 |

## 任务

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `quest_list` | C→S | - | 查看可接任务 |
| `quest_available` | S→C | Quest数组 | 可接任务列表 |
| `quest_accept` | C→S | `{ questId }` | 接取任务 |
| `quest_accepted` | S→C | Quest对象 | 接取成功 |
| `quest_progress` | S→C | `{ questId, progress }` | 任务进度更新 |
| `quest_completed` | S→C | `{ questId, rewards }` | 任务完成 |
| `quest_claim_reward` | C→S | `{ questId }` | 领取奖励 |
| `quest_reward_claimed` | S→C | `{ questId, rewards }` | 奖励领取成功 |

## 休息与恢复

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `rest` | C→S | - | 休息恢复 |
| `rest_complete` | S→C | `{ hp, mp, fullRecovery }` | 休息完成 |
| `natural_regen` | S→C | `{ hp, mp }` | 自然恢复（每60秒） |

## 死亡与复活

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `revive` | C→S | - | 复活 |
| `revived` | S→C | `{ hp, mp, location, message }` | 复活成功 |

## 聊天

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `chat_message` | C→S | `{ content }` | 发送聊天 |
| `chat_broadcast` | S→C | `{ name, content, timestamp }` | 聊天广播 |

## 错误

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `error` | S→C | `{ message }` | 操作失败 |

## 系统消息

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `system_message` | S→C | `{ content }` | 系统提示 |

---

*最后更新: 2026-05-16*