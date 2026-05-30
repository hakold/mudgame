# 侠客行 MUD — NPC 生成规范

> 本文档供 AI 智能体使用，用于批量生成符合项目标准的新 NPC 配置。
> 所有 NPC 数据存入 `config/json/npcs.json`（JSON 数组），一个 NPC 对应一个 JSON 对象。

---

## 1. 项目背景

**侠客行**是一款中国古代武侠题材的文字 MUD 游戏。世界设定为古典仙侠风格，所有内容须符合中国古代武侠世界观，禁止出现西幻魔法、科幻、现代等无关元素。

- **后端**: Express + Socket.IO (Node.js)
- **前端**: Vue 3 + Vite
- **配置驱动**: 游戏逻辑由 `config/json/` 下的 JSON 文件驱动
- **NPC 文件**: `config/json/npcs.json`

---

## 2. NPC 通用结构

每个 NPC 是一个 JSON 对象，包含以下**通用字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 全局唯一标识，命名规范见 §3 |
| `name` | string | ✅ | 显示名称，2~6 字为宜，允许直接使用姓+名的格式 |
| `description` | string | ✅ | 外观/背景描述，10~40 字，古文白话风格，需要描述清楚角色是什么人。 |
| `type` | string | ✅ | NPC 类型，必须是 §4 中列举的类型之一 |
| `roomIds` | string[] | ✅ | 所在房间 ID 列表，至少 1 个，必须是已有房间 ID |
| `dialogues` | object | 推荐 | 对话集合，见 §5 |
| `quests` | string[] | 按需 | 关联任务 ID 列表（仅 quest_giver / faction / shop / trainer 需要） |
| `services` | string[] | 按需 | 提供的服务标识（service / shop / trainer / faction / teleport 需要） |

**核心原则**：
- 对话与任务解耦：任务 NPC 只通过 `quests` 字段关联任务 ID，对话内容由**任务配置** (`quests.json` 的 `dialogue` 字段) 管理
- NPC 的 `dialogues` 仅存放**非任务对话**（问候、闲聊、服务介绍等）
- **不做字段加法**：不允许新增未在本规范中列出的字段

---

## 3. 命名规范

### 3.1 ID 格式
```
npc_{英文角色描述}
```
- 全部小写，单词用下划线分隔
- 命名要见名知意，如 `npc_innkeeper`（客栈老板）、`npc_guard_captain`（守卫队长）

### 3.2 引用外键 — 必须使用已有 ID

NPC 配置中引用的以下字段，**必须来自对应 JSON 文件中的已有配置**：

| 字段 | 引用来源 | 文件 |
|------|----------|------|
| `roomIds` | 房间 ID | `config/json/rooms.json` |
| `quests` | 任务 ID | `config/json/quests.json` |
| `skills` | 技能 ID | `config/json/skills.json` |
| `items` | 物品 ID | `config/json/items.json` |
| `factionId` | 门派 ID | `config/json/factions.json` |

**引用前务必查询对应源文件确认 ID 存在。**

---

## 4. NPC 类型详解

### 4.1 类型总览

| type | 中文名 | 用途 | 特有字段 |
|------|--------|------|----------|
| `quest_giver` | 任务发布者 | 发布主线/支线任务 | `quests` |
| `service` | 服务型 | 提供客栈/钱庄等纯服务 | `services` |
| `shop` | 商店 | 出售物品 | `shopType`, `items`, `services` |
| `trainer` | 训练师 | 传授武功 | `skills`, `services` |
| `faction` | 门派招募 | 招募玩家加入门派 | `factionId`, `services` |
| `faction_exchange` | 门派兑换 | 贡献值兑换物品/技能 | `factionId`, `items`/`skills`, `services` |
| `arena` | 竞技场 | 安排 PvP 对战 | — |
| `teleport` | 传送 | 收费传送至其他地点 | `teleportDestinations`, `services` |
| `atmosphere` | 氛围 NPC | 纯背景/装饰/闲聊，无任何功能 | — |

### 4.2 类型详细规范

#### quest_giver（任务发布者）

```json
{
  "id": "npc_village_chief",
  "name": "村长",
  "description": "村庄的老村长，慈祥而睿智。",
  "type": "quest_giver",
  "quests": ["quest_talk_chief", "quest_kill_boars"],
  "dialogues": {
    "greeting": [
      "年轻人，欢迎来到我们村庄。有什么需要帮助的吗？",
      "又见面了，少侠。村子虽小，但总有些事情需要人手帮忙。"
    ]
  },
  "roomIds": ["Daoxiang_village_center"]
}
```

约束：
- `quests` 必须至少包含 1 条任务 ID
- `dialogues.greeting` 至少 2 条变体（数组），轮换使用
- 对话不涉及具体任务内容（任务对话由 quests.json 管理）

#### service（服务型）

```json
{
  "id": "npc_innkeeper",
  "name": "客栈老板",
  "description": "客栈的老板，热情好客。",
  "type": "service",
  "services": ["rest", "rumor"],
  "dialogues": {
    "greeting": ["欢迎光临！要住店还是打听消息？"],
    "rest": "一间房50金币，可以恢复全部HP和MP。",
    "rumor": "最近听说洛阳城来了不少江湖人物..."
  },
  "roomIds": ["Daoxiang_village_inn"]
}
```

约束：
- `services` 不能为空，常用值：`rest`（恢复）、`rumor`（打听消息）、`bank`（存取钱）、`storage`（仓库）
- 每种 `services` 中的服务建议在 `dialogues` 中有对应对话 Key

#### shop（商店）

```json
{
  "id": "npc_blacksmith",
  "name": "铁匠老张",
  "description": "村里的铁匠，手艺精湛。",
  "type": "shop",
  "shopType": "weapon",
  "items": ["weapon_wooden_sword", "weapon_oak_staff", "weapon_iron_sword"],
  "services": ["buy_item", "repair", "shop"],
  "dialogues": {
    "greeting": ["要打造武器还是修理装备？"],
    "buy": "看看这些武器，都是我亲手打造的。"
  },
  "roomIds": ["Daoxiang_village_blacksmith"]
}
```

约束：
- `shopType` 必填，必须是 `weapon` / `armor` / `general` / `herb` / `food` / `accessory` 之一
- `items` 至少 3 个，全部必须来自 `items.json` 已有 ID
- `services` 至少包含 `shop`，推荐加上 `buy_item`、`sell_item`

#### trainer（训练师）

```json
{
  "id": "npc_shaolin_abbot",
  "name": "方证大师",
  "description": "少林寺方丈，佛法精深",
  "type": "trainer",
  "skills": ["skill_shaolin_fist", "skill_shaolin_palm"],
  "services": ["learn_skill", "train"],
  "dialogues": {
    "greeting": ["阿弥陀佛，施主可是来学武的？"],
    "learn": "少林武学，刚猛霸道。",
    "train": "勤学苦练，方成大器。"
  },
  "roomIds": ["shaolin_temple"]
}
```

约束：
- `services` 推荐包含 `learn_skill`、`train`、`meditate` 等
- `skills` 至少 1 个，全部来自 `skills.json`
- 建议提供 `dialogues.learn` 和 `dialogues.train`

#### faction（门派招募）

```json
{
  "id": "npc_faction_shaolin",
  "name": "少林弟子",
  "description": "少林派弟子，在此招募新成员。",
  "type": "faction",
  "factionId": "shaolin",
  "quests": ["quest_join_faction"],
  "services": ["learn_skill", "meditate"],
  "dialogues": {
    "greeting": ["少林派欢迎有志之士加入。"],
    "join": "加入少林派需要等级5以上。",
    "joined": "欢迎加入少林派！"
  },
  "roomIds": ["mountain_temple"]
}
```

约束：
- `factionId` 必填，必须等于 `factions.json` 中某个门派的 `id`
- `dialogues` 必须包含 `join`（未加入时提示）和 `joined`（加入后提示）
- `quests` 必须包含 `quest_join_faction`

#### arena（竞技场）

```json
{
  "id": "npc_arena_master",
  "name": "竞技场主持",
  "description": "竞技场的主持，负责安排比赛。",
  "type": "arena",
  "dialogues": {
    "greeting": ["想在竞技场挑战其他侠客吗？"],
    "challenge": "选择对手开始战斗吧。",
    "result": "战斗结束！"
  },
  "roomIds": ["city_arena"]
}
```

#### teleport（传送）

```json
{
  "id": "npc_village_carter",
  "name": "门派传送车夫",
  "description": "专门负责将侠客送往各大门派的马车夫",
  "type": "teleport",
  "services": ["teleport"],
  "teleportDestinations": [
    {
      "id": "shaolin",
      "name": "少林寺",
      "roomId": "shaolin_gate",
      "cost": 100
    }
  ],
  "dialogues": {
    "greeting": ["想去哪个门派？我可以送你一程。"],
    "teleport": "请选择目的地"
  },
  "roomIds": ["Daoxiang_village_center"]
}
```

约束：
- `teleportDestinations` 必填，至少 1 个目的地
- 每个目的地的 `roomId` 必须来自 `rooms.json`
- `services` 必须包含 `teleport`
- 门派传送类 NPC 建议放在村庄、各门派门口等合理位置

#### atmosphere（氛围 NPC）

```json
{
  "id": "npc_street_vendor",
  "name": "街头小贩",
  "description": "挑着担子沿街叫卖的小贩，嘴里哼着不知名的小调。",
  "type": "atmosphere",
  "dialogues": {
    "greeting": ["来看看新鲜的瓜果！", "客官不买看看也行~"]
  },
  "roomIds": ["Luoyang_city_center"]
}
```

约束：
- **不能有** `services`、`quests`、`items`、`skills`、`factionId`、`teleportDestinations`、`shopType`
- 可以有 `dialogues.greeting`
- 用于充实场景氛围，让地图看起来更热闹

---

## 5. 对话规范 (dialogues)

### 5.1 结构

```json
"dialogues": {
  "greeting": ["欢迎来到...", "你好..."],
  "rumor": "听说最近...",
  "buy": "看看这些...",
  // ... 其他类型特定对话
}
```

### 5.2 对话变量

每个 Key 可以是 **字符串** 或 **字符串数组**。数组形式表示多条轮换变体：
```json
"greeting": ["第一句问候", "第二句问候", "第三句问候"]
```
`greeting` 推荐至少 **2~5 条**变体以增加游戏丰富度。

### 5.3 对话风格要求

- **文言白话风格**：半文半白，既保留古风又让现代玩家可读
- **语气贴切角色**：
  - 和尚/NPC 道士：庄重、禅意，"阿弥陀佛…施主请留步"
  - 客栈老板：热情，"客官来得正好，小店还有上房"
  - 铁匠：豪爽，"看看这些武器，都是我亲手打造的"
  - 村夫/渔夫：质朴，"今天运气不错，钓了不少鱼"
  - 仙人/高人：玄妙，"有缘人，你终于来了"
- **禁止**：网络用语、现代英文、火星文、emoji
- **每条对话 10~40 字**

### 5.4 常用对话 Key

| Key | 使用场景 | 适用类型 |
|-----|----------|----------|
| `greeting` | 玩家与 NPC 对话时的第一句 | **所有类型** |
| `rumor` | 打听消息 | service, shop, atmosphere |
| `buy` | 购买物品时 | shop |
| `sell` | 出售物品时 | shop |
| `rest` | 住店恢复时 | service |
| `repair` | 修理装备时 | shop |
| `learn` | 学习技能时 | trainer |
| `train` | 训练时 | trainer |
| `join` | 询问加入门派时（未加入） | faction |
| `joined` | 加入门派后 | faction |
| `challenge` | 挑战前 | arena |
| `result` | 挑战结束后 | arena |
| `teleport` | 选择目的地时 | teleport |
| `deposit` | 存钱时 | service (bank) |
| `withdraw` | 取钱时 | service (bank) |

---

## 6. 房间 ID 参考 (rooms.json)

以下是当前所有可用房间 ID（建议新增 NPC 优先放到已有房间）：

```
# 稻香村 (新手区 1-10 级)
Daoxiang_village_center      — 稻香村广场
Daoxiang_village_north       — 稻香村北街
Daoxiang_village_east        — 稻香村东街
Daoxiang_village_south       — 稻香村南街
Daoxiang_village_west        — 稻香村西街
Daoxiang_village_inn         — 稻香村客栈
Daoxiang_village_shop        — 稻香村杂货铺
Daoxiang_village_blacksmith  — 稻香村铁匠铺
Daoxiang_village_training    — 稻香村练武场
Daoxiang_village_field       — 稻香村田边
Daoxiang_village_river       — 稻香村江边
Daoxiang_village_eastdoor    — 稻香村东门外

# 迷雾森林 (5-15 级)
Cloud_forest_outside          — 迷雾森林边缘
Cloud_forest_deep             — 迷雾森林深处
Cloud_forest_path             — 林间小径
Cloud_forest_medic_home       — 药师草庐
Cloud_forest_waterfall        — 林中瀑布
Cloud_forest_cave             — 神秘洞穴
Cloud_forest_cemetery         — 乱葬岗
Cloud_forest_cave_cemetery    — 地下墓穴
Cloud_forest_mining_rest      — 矿工歇脚点

# 青云山 (15-30 级)
Qingyun_mountain_path                 — 山道
Qingyun_mountain_temple               — 寺庙 (原 mountain_temple)
Qingyun_mountain_peak                 — 山顶 (原 mountain_peak)
Qingyun_mountain_side         — 青云山下
Qingyun_mountain_midroad      — 青云山道
Qingyun_mountain_top          — 青云山山顶
Qingyun_mountain_temple       — 青云山道观
Qingyun_mountain_foot         — 青云山底
Qingyun_mountain_valley       — 迷雾谷
Qingyun_mountain_mirrorlake   — 镜湖小岛

# 洛阳城 (10-50 级)
Luoyang_city_city_gate                     — 城门
Luoyang_city_city_square                   — 城市广场
Luoyang_city_city_tavern                   — 醉仙楼
Luoyang_city_city_market                   — 集市
Luoyang_city_city_arena                    — 竞技场
Luoyang_city_city_guild                    — 侠客公会
Luoyang_city_center           — 洛阳城中心广场
Luoyang_city_south_street     — 洛阳城中心南街
Luoyang_city_south_gate       — 洛阳城南门
Luoyang_city_south_side       — 洛阳城南郊
```

---

## 7. 门派/技能/物品参考

### 7.1 门派 (factions.json)

```
shaolin   — 少林派
wudang    — 武当派
emei      — 峨眉派
beggar    — 丐帮
mingjiao  — 明教
xiaoyao   — 逍遥派
```

### 7.2 技能 (skills.json)

共 90 个技能，ID 命名规则：`skill_{派系/描述}_{技能名}`。部分示例：
- 基础: `skill_basic_attack`, `skill_heal_basic`, `skill_meditation`
- 少林: `skill_shaolin_fist`, `skill_shaolin_palm`, `skill_shaolin_staff`, `skill_golden_bell`, `skill_lion_roar`, `skill_yijinjing`, `skill_damo_sword`, `skill_xisuijing`, `skill_shaolin_divine`
- 武当: `skill_wudang_fist`, `skill_wudang_sword`, `skill_wudang_xinfa`, `skill_taiji_jin`, `skill_liangyi_sword`, `skill_zhenwu_sword`, `skill_tiyunzong`, `skill_chunyang`, `skill_jiutian_xuangong`
- 峨眉: `skill_emei_sword`, `skill_jiuyang`, `skill_emei_xinfa`, `skill_emei_thorn`, `skill_jinding_light`, `skill_emei_divine`, `skill_yunv_sword`, `skill_mercy_palm`, `skill_lotus_palm`
- 丐帮: `skill_gaibang_stick`, `skill_xianglong`, `skill_gaibang_xinfa`, `skill_gaibang_formation`, `skill_kanglong`, `skill_drunken_fist`, `skill_fenyin_bu`
- 明教: `skill_mingjiao_fire`, `skill_mingjiao_xinfa`, `skill_blazing_blade`, `skill_holy_flame_order`, `skill_light_fist`, `skill_burn_heaven`, `skill_mingjiao_qiankun`
- 逍遥: `skill_xiaoyao_xinfa`, `skill_lingbo_weibu`, `skill_beiming`, `skill_xiaoyao_sword`, `skill_tianshan_liuyang`, `skill_bahuang`

### 7.3 物品 ID 前缀 (items.json)

共 848 个物品：
- `weapon_*` — 武器 (如 `weapon_wooden_sword`, `weapon_iron_sword`)
- `armor_*` — 防具 (如 `armor_cloth`, `armor_leather`)
- `helmet_*` — 头盔 (如 `helmet_bronze`, `helmet_iron`)
- `boots_*` — 靴子 (如 `boots_cloth`, `boots_leather`)
- `ring_*` — 戒指 (如 `ring_jade`, `ring_ruby`)
- `accessory_*` — 饰品 (如 `accessory_strength_necklace`)
- `item_*` — 消耗品/材料/杂物
- `skill_book_*` — 功法书

---

## 8. 完整示例

以下是一个覆盖主要字段的完整 NPC 配置示例：

```json
{
  "id": "npc_city_doctor",
  "name": "回春堂大夫",
  "description": "回春堂的坐诊大夫，悬壶济世，妙手回春。",
  "type": "service",
  "services": ["heal", "rumor"],
  "dialogues": {
    "greeting": [
      "这位侠士，看你气色不佳，可要老夫为你把把脉？",
      "救人一命胜造七级浮屠，快请进来坐下。",
      "行走江湖磕磕碰碰在所难免，老夫这里专治跌打损伤。"
    ],
    "heal": "来，先服下这碗药汤，气血即刻恢复。",
    "rumor": "最近城南来了个怪人，专收百年灵芝，也不知是何方神圣。"
  },
  "roomIds": ["Luoyang_city_south_street"]
}
```

---

## 9. 生成任务要求

当被要求生成 NPC 时，请严格遵循以下步骤：

1. **确认场景**：该 NPC 属于哪个地图/区域？（参考 §6 房间表）
2. **确认类型**：该 NPC 提供什么功能？（参考 §4 类型表）
3. **查询引用**：所有外键（房间/任务/技能/物品/门派 ID）是否确实存在？
4. **设计对话**：对话是否符合角色身份？是否文言白话风格？
5. **检查字段**：是否只用了本规范允许的字段？是否有多余字段？
6. **输出格式**：输出完整 JSON 对象（单个）或 JSON 数组（多个），直接可追加到 `npcs.json`

---

## 10. 常见错误（禁止）

| 错误 | 正确做法 |
|------|----------|
| 使用不存在的 roomId | 先查询 `rooms.json` 确认 |
| 引用不存在的 item/skill/quest ID | 先查询对应 JSON 文件 |
| dialogue 写成 `"greeting": "你好"` | `greeting` 必须是**数组** |
| 在 NPC dialog 里写任务对话 | 任务对话放 `quests.json` 的 `dialogue` |
| 添加本规范未列出的字段 | NPC 只做减法不做加法 |
| ID 不唯一 | 命名时搜索现有 NPC 确认无重名 |
| 对话中出现西幻/现代元素 | 纯中国古代武侠风格 |
| atmosphere NPC 带了 services/quests | atmosphere 零字段 |
| 商店 shopType 瞎填 | 必须是 weapon/armor/general/herb/food/accessory |
