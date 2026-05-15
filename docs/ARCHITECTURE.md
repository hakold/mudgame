# 系统架构

## 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | Vue 3 + Vite | SPA，Socket.IO客户端 |
| 后端 | Node.js + Express | REST API + Socket.IO |
| 数据库 | MongoDB | 用户/背包/技能/任务/战斗日志 |
| 缓存 | Redis | Session/在线状态 |
| 认证 | JWT | Token认证 |

## 目录结构

```
Gameproject/
├── client/                     # 前端 Vue 3
│   ├── src/
│   │   ├── views/
│   │   │   └── Game.vue        # 主游戏界面（861行）
│   │   ├── stores/
│   │   │   └── game.js         # Pinia状态管理（589行）
│   │   ├── router/
│   │   ├── components/
│   │   └── App.vue
│   ├── .env                    # VITE_API_URL, VITE_SOCKET_URL
│   └── .env.example
├── server/                     # 后端 Node.js
│   ├── src/
│   │   ├── app.js              # Express入口
│   │   ├── config/index.js     # 环境配置
│   │   ├── game/
│   │   │   ├── index.js        # 游戏配置加载（JSON→内存）
│   │   │   ├── battleService.js    # 战斗核心逻辑（~900行）
│   │   │   ├── questProgressService.js  # 任务进度追踪
│   │   │   └── roomDropsService.js  # 房间地面掉落物品
│   │   ├── socket/
│   │   │   └── index.js        # Socket.IO事件处理（~1300行）
│   │   ├── models/
│   │   │   ├── User.js         # 用户模型（含门派/死亡/复活方法）
│   │   │   ├── CharacterSkill.js   # 角色技能（含升级方法）
│   │   │   ├── Inventory.js    # 背包物品（含耐久度方法）
│   │   │   ├── Quest.js        # 任务进度
│   │   │   ├── BattleLog.js    # 战斗日志
│   │   │   └── ChatMessage.js  # 聊天消息
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── middleware/
│   ├── .env                    # 环境变量
│   └── .env.example
├── config/json/                # 游戏内容配置
│   ├── maps.json               # 地图区域（12个）
│   ├── rooms.json              # 房间（51个）
│   ├── npcs.json               # NPC（10个）
│   ├── monsters.json           # 怪物（23个）
│   ├── items.json              # 物品（67个）
│   ├── skills.json             # 技能（54个）
│   ├── quests.json             # 任务（24个）
│   └── factions.json           # 门派（6个）
├── docs/                       # 项目文档
└── ai_read/                    # AI协作者进度记录
```

## 数据流

```
客户端 (Vue 3)
    ↕ Socket.IO (实时事件)
    ↕ REST API (认证/用户信息)
服务端 (Express + Socket.IO)
    ↕ Mongoose ODM
MongoDB (持久化)
    ↕ ioredis
Redis (Session/缓存)
```

### 战斗数据流
```
1. 客户端 emit('battle_start', { monsterId })
2. battleService.createBattle() → 初始化战斗状态
3. 客户端 emit('battle_action', { battleId, action, skillId })
4. battleService.executeTurn() → 回合处理
   - processStartOfTurnEffects() → 被动技能/mpRegen
   - 普通攻击/技能攻击 → 伤害计算
   - applyCounterAttack() → 反击
   - 状态效果tick → buff/debuff/poison/burn
5. emit('battle_update') → 回合结果
6. 战斗结束 → emit('battle_ended')
   - 经验/金币/技能经验
   - 掉落物品到房间地面
   - 死亡惩罚（如果玩家死亡）
```

### 任务进度数据流
```
游戏事件 → questProgressService.checkProgress(userId, event)
event类型: kill/visit/talk/collect/learn_skill/train
→ 匹配任务目标 → 更新进度 → 自动完成
```

## 关键设计决策

1. **配置驱动**: 游戏内容（怪物/物品/技能/房间）全部在JSON配置中定义，运行时加载到内存
2. **Socket.IO实时**: 所有游戏交互通过Socket.IO事件，REST仅用于认证
3. **房间频道**: 每个房间有独立的Socket.IO频道（`room:${roomId}`），支持房间内广播
4. **战斗隔离**: 每场战斗有独立频道（`battle:${battleId}`），战斗结束自动清理
5. **地面掉落**: 怪物掉落物品放在房间地面而非直接进背包，玩家主动拾取
6. **自然恢复**: 非战斗状态下每60秒自动恢复2%HP/3%MP

---

*最后更新: 2026-05-16*
