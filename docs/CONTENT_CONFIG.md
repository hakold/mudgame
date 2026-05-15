# 游戏内容配置文档

所有游戏内容通过 `config/json/` 下的JSON文件定义，服务端启动时加载到内存。

## 配置文件概览

| 文件 | 数量 | 说明 |
|------|------|------|
| maps.json | 12 | 地图区域 |
| rooms.json | 51 | 房间 |
| npcs.json | 10 | NPC |
| monsters.json | 23 | 怪物 |
| items.json | 67 | 物品 |
| skills.json | 54 | 技能 |
| quests.json | 24 | 任务 |
| factions.json | 6 | 门派 |

## maps.json — 地图区域

```json
{
  "id": "village",
  "name": "新手村",
  "description": "宁静的小村庄，新手玩家的起点",
  "levelRange": [1, 10],
  "rooms": ["village_center", "village_inn", ...]
}
```

| 地图ID | 名称 | 等级范围 |
|--------|------|----------|
| village | 新手村 | 1-10 |
| forest | 迷雾森林 | 5-15 |
| mountain | 崇山峻岭 | 15-30 |
| city | 洛阳城 | 10-50 |
| desert | 大漠荒原 | 25-40 |
| snow | 极寒冰原 | 35-50 |
| swamp | 幽暗沼泽 | 20-35 |
| island | 海外仙岛 | 40-60 |
| underground | 地下迷宫 | 30-45 |
| volcano | 火焰山 | 45-60 |
| palace | 皇宫 | 50+ |

## rooms.json — 房间

```json
{
  "id": "village_center",
  "name": "村庄中心",
  "description": "村庄的中心广场...",
  "mapId": "village",
  "exits": [
    { "direction": "north", "roomId": "village_inn", "name": "客栈" },
    ...
  ],
  "services": ["shop", "buy_item", "sell_item"],
  "shopType": "general",
  "npcs": ["npc_village_chief"],
  "monsters": []
}
```

**房间服务类型**:
- `rest` — 休息（完全恢复HP/MP）
- `shop` / `buy_item` / `sell_item` — 商店
- `train` — 训练属性
- `learn_skill` — 学习技能
- `blacksmith` / `repair` — 铁匠修复装备
- `rumor` / `drink` / `water` / `trade` — 其他

**有rest服务的房间**: village_inn, city_tavern, desert_oasis, snow_village
**有shop服务的房间**: village_shop, city_market
**有train服务的房间**: village_training, mountain_temple, city_arena

## npcs.json — NPC

```json
{
  "id": "npc_village_chief",
  "name": "村长",
  "description": "慈祥的老人...",
  "roomId": "village_center",
  "dialog": "年轻人，欢迎来到...",
  "services": ["quest", "talk"],
  "skills": ["skill_basic_attack"]
}
```

| NPC ID | 名称 | 房间 | 服务 |
|--------|------|------|------|
| npc_village_chief | 村长 | village_center | quest, talk |
| npc_innkeeper | 客栈老板 | village_inn | rest, rumor |
| npc_blacksmith | 铁匠 | village_blacksmith | blacksmith, repair |
| npc_shopkeeper | 店老板 | village_shop | shop |
| npc_trainer | 武师 | village_training | train, learn_skill |
| npc_faction_shaolin | 少林方丈 | mountain_temple | faction |

## monsters.json — 怪物

```json
{
  "id": "monster_wild_rabbit",
  "name": "野兔",
  "level": 1,
  "hp": 30, "mp": 0,
  "attack": 5, "defense": 2,
  "exp": 10, "gold": 3,
  "drops": [
    { "itemId": "item_rabbit_meat", "rate": 0.5, "quantity": 1 },
    { "itemId": "item_rabbit_fur", "rate": 0.3, "quantity": 1 }
  ],
  "skills": [],
  "roomId": "village_center",
  "respawnTime": 300
}
```

**怪物等级分布**:
- 1-5级: 野兔、野猪、野狼
- 5-15级: 森林蛇、山贼、灰狼
- 15-30级: 黑熊、老虎、山贼头目
- 30-50级: 魔教弟子、江湖杀手、妖兽
- 50+级: 狼王(BOSS)、火龙(BOSS)、魔王(BOSS)

## items.json — 物品

**物品类型**: weapon / armor / consumable / material

**消耗品** (consumable):
| ID | 名称 | 效果 | 价格 |
|----|------|------|------|
| item_hp_potion_small | 小还丹 | +50HP | 50金 |
| item_hp_potion_medium | 中还丹 | +150HP | 150金 |
| item_hp_potion_large | 大还丹 | +500HP | 400金 |
| item_mp_potion_small | 小回气丹 | +30MP | 40金 |
| item_mp_potion_medium | 中回气丹 | +100MP | 120金 |
| item_mp_potion_large | 大回气丹 | +300MP | 300金 |
| item_herb | 草药 | +20HP | 10金 |

**武器** (weapon): 木剑→铁剑→钢剑→玄铁剑→火龙剑 等
**防具** (armor): 布衣→皮甲→铁甲→金丝甲 等
**材料** (material): 怪物掉落材料（兔肉、兔皮、狼牙、龙鳞等）

## skills.json — 技能

**技能类型**: attack / defense / heal / buff / debuff / passive

**通用技能** (faction: general):
| ID | 名称 | 类型 | MP消耗 | 效果 |
|----|------|------|--------|------|
| skill_basic_attack | 基础攻击 | attack | 0 | 基础伤害 |
| skill_heal_basic | 基础治疗 | heal | 15 | 恢复HP |
| skill_meditation | 冥想 | passive | 0 | 每回合+5MP |

**门派技能** (faction: shaolin/wudang/emei/gaibang/mingjiao):
- 少林: 长拳、棍法、易筋经（被动buff+体质）
- 武当: 太极拳（反击0.2）、太极剑、梯云纵
- 峨眉: 峨眉剑法、冰心诀
- 丐帮: 打狗棒法、降龙十八掌
- 明教: 乾坤大挪移（反射）、圣火功

**门派等级限制** (rankRequired):
- disciple: 基础门派技能
- deacon: 中级技能
- elder: 高级技能
- leader: 绝学

## quests.json — 任务

**任务类型**: main / side / daily / repeatable

**进度触发类型**:
- `kill` — 击杀怪物（支持 `monsterId: 'any'` 通配）
- `visit` — 到达房间（支持 `roomId: 'any'` 通配）
- `talk` — 与NPC对话
- `collect` — 拾取物品（支持 `itemId: 'any'` 通配）
- `learn_skill` — 学习技能（支持 `minLevel` 检查）
- `train` — 训练属性

**新手主线** (8个任务):
1. 初入江湖 → 与村长对话
2. 装备自己 → 购买木剑
3. 初试身手 → 击杀野猪
4. 拜师学艺 → 加入门派
5. 技能初成 → 学习技能
6. 森林探险 → 到达森林深处
7. 挑战强敌 → 击杀狼王
8. 进城 → 到达洛阳城

## factions.json — 门派

| 门派ID | 名称 | 要求等级 | 特色 |
|--------|------|----------|------|
| shaolin | 少林寺 | 5 | 外功/棍法/易筋经 |
| wudang | 武当派 | 5 | 太极/反击/轻功 |
| emei | 峨眉派 | 8 | 剑法/冰心诀 |
| gaibang | 丐帮 | 10 | 棒法/降龙十八掌 |
| mingjiao | 明教 | 15 | 乾坤大挪移/反射 |
| huashan | 华山派 | 10 | 剑法/气宗 |

**门派等级**: 弟子(disciple) → 执事(deacon, 100声望+10级) → 长老(elder, 500声望+25级) → 掌门(leader, 2000声望+50级)

---

*最后更新: 2026-05-16*