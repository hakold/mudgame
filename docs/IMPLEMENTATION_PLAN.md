# 武侠MUD游戏实现方案

基于北大侠客行MUD的核心玩法，制定功能实现方案。

参考Wiki: https://www.pkuxkx.net/wiki/doku.php

## 一、核心系统优先级

### P0 - 基础系统 ✅ 已完成
1. **战斗系统** - 回合制PVE/PVP，技能使用，状态效果
2. **商店系统** - buy/sell物品
3. **技能系统** - 学习技能、使用技能、被动技能
4. **属性升级** - train提升属性 + freePoints分配
5. **任务系统** - 主线/支线/日常任务，自动进度追踪

### P1 - 进阶系统 ✅ 已完成
- 门派系统完善（声望/贡献/等级进阶）
- 装备系统（耐久度/修复）
- 掉落拾取系统
- 死亡惩罚与复活
- 技能经验与升级
- 战斗日志查询

### P2 - 后台与安全（Phase 9-10）
- 游戏后台管理系统（配置任务/道具/地图、玩家管理、行为日志、Dashboard）
- 防作弊与安全维护（输入验证、服务端校验、并发安全、会话安全、异常检测、数据备份、通信安全、GM审计）

## 二、系统详细设计

### 1. 战斗系统 ✅

**核心机制**:
- 回合制战斗，基于dexterity决定行动顺序
- 普通攻击、技能攻击、防御、逃跑
- 状态效果系统（buff/debuff/poison/burn/stun/freeze/fear）
- 被动技能每回合生效（mpRegen、持久buff）
- 反击机制（counterChance）
- 伤害反射（reflectChance）

**战斗流程**:
1. `kill <怪物名>` - 发起战斗
2. 回合制，每回合选择动作
3. 可用动作：attack/skill/item/flee
4. 战斗结束获得经验、金币、地面掉落

**战斗快捷按钮**: ⚔️攻击 🎯技能 💊物品 🏃逃跑

### 2. 商店系统 ✅

**NPC商店类型**: weapon_shop / armor_shop / potion_shop / general_shop

**命令**: shop查看 / buy购买 / sell出售(50%价格)

### 3. 技能系统 ✅

**技能类型**: attack / defense / heal / buff / debuff / passive

**学习**: 向NPC学习，等级/门派/门派等级限制，金币消耗

**升级**: 战斗中使用技能获得经验，自动升级（最高10级）

**被动技能**: mpRegen每回合恢复MP，持久buff（如易筋经+体质），counterChance反击

**门派技能**: 少林/武当/峨眉/丐帮/明教，门派等级解锁高级技能

### 4. 属性升级系统 ✅

**基础属性**: strength(力量) / dexterity(敏捷) / constitution(体质) / intelligence(悟性)

**升级方式**:
- `train <属性>` - 消耗经验和金币训练
- `allocate_points` - 使用freePoints分配（升级+3点，门派进阶+5点）

### 5. 任务系统 ✅

**任务类型**: main / side / daily / repeatable

**进度触发**: kill(击杀) / visit(到达) / talk(对话) / collect(拾取) / learn_skill(学技能) / train(训练)

**新手主线**: 8个任务从初入江湖到进城

### 6. 门派进阶系统 ✅

**等级**: 弟子(disciple) → 执事(deacon, 需100声望+10级) → 长老(elder, 需500声望+25级) → 掌门(leader, 需2000声望+50级)

**门派任务**: 捐献100金币→+10声望

**进阶奖励**: +5自由属性点，解锁高级门派技能

### 7. 掉落拾取系统 ✅

**机制**: 怪物掉落物品放在房间地面，不直接进背包

**操作**: look查看地面物品 / pickup_item拾取 / 自动堆叠同类物品

**过期**: 30分钟自动清理

**任务触发**: 拾取物品触发collect类型任务进度

### 8. 死亡惩罚与复活 ✅

**死亡惩罚**: 10%经验损失 + 5%金币损失 + 装备耐久额外-10

**复活**: 30%HP/MP，传送回village_center

### 9. 装备耐久度系统 ✅

**消耗**: 战斗每件装备-1~3耐久，死亡额外-10

**修复**: 铁匠铺修复（1金币/点耐久），支持单件/全部修复

### 10. 战斗日志 ✅

**查询**: get_battle_logs(分页) / get_battle_detail(详情)

## 三、UI快捷按钮设计

**主界面**: 👁️查看 📍位置 📊状态 🎒背包 ⚔️技能 📜任务 🏪商店 💊买药 💤休息 🏯门派 ❓帮助

**战斗中**: ⚔️攻击 🎯技能 💊物品 🏃逃跑

**NPC对话**: 根据NPC类型动态显示购买/出售/学习/训练/任务按钮

## 四、快捷命令汇总

```
移动: go/move <方向>, look/l, where
交互: talk <NPC>, shop, buy, sell, rest
战斗: kill, attack/a, skill, flee
成长: learn, train, allocate_points, skills
门派: faction, join_faction, leave_faction, faction_advance, faction_task
物品: pickup_item, look_drops, repair_item, repair_all
任务: quest list, quest accept, quest complete
其他: revive, get_battle_logs, get_battle_detail
```

## 五、配置文件

| 文件 | 内容 | 数量 |
|------|------|------|
| config/json/maps.json | 地图区域 | 12 |
| config/json/rooms.json | 房间 | 51 |
| config/json/npcs.json | NPC | 10 |
| config/json/monsters.json | 怪物 | 23 |
| config/json/items.json | 物品 | 67 |
| config/json/skills.json | 技能 | 54 |
| config/json/quests.json | 任务 | 24 |
| config/json/factions.json | 门派 | 6 |

## 六、环境配置

**服务端** (server/.env):
- PORT, HOST, GAME_NAME, GAME_VERSION
- MONGODB_HOST, MONGODB_PORT, MONGODB_DATABASE, MONGODB_USER, MONGODB_PASSWORD
- REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
- JWT_SECRET, JWT_EXPIRES_IN
- CORS_ORIGINS

**客户端** (client/.env):
- VITE_API_URL, VITE_SOCKET_URL

---

*文档版本: 2.0*
*最后更新: 2026-05-16*
