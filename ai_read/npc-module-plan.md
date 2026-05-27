# NPC 管理模块开发计划

> **参照标准**：地图管理模块（`Admin.vue` 地图 Tab + `gmController.js` 地图路由）
> **数据规模**：299 个 NPC，8 种类型，7 个字段子集

---

## 一、数据模型

### NPC 通用字段

| 字段 | 说明 | 必填 |
|------|------|------|
| `id` | 唯一ID（如 `npc_village_chief`） | ✅ |
| `name` | 显示名称 | ✅ |
| `description` | 描述文本 | |
| `type` | 类型（见下方） | ✅ |
| `roomIds` | 出现房间ID数组 | ✅ |
| `dialogues` | 对话配置对象 | ✅ |

### NPC 类型与专属字段

| type | 数量 | 专属字段 | 说明 |
|------|------|----------|------|
| `service` | 170 | `services[]` | 服务列表（rest/rumor/heal/repair...） |
| `shop` | 40 | `shopType` + `items[]` | 商店类型+商品列表 |
| `trainer` | 37 | `skills[]` | 可教的技能ID列表 |
| `quest_giver` | 32 | `quests[]` | 可接的任务ID列表 |
| `teleport` | 7 | `teleportDestinations[]` | 传送目标 |
| `faction` | 6 | `factionId` + `services[]` | 所属门派 |
| `faction_exchange` | 6 | `services[]` | 门派贡献兑换 |
| `arena` | 1 | — | 竞技场主持（无专属字段） |

---

## 二、UI 设计

### Tab 入口

在 `Admin.vue` 左侧菜单增加：
```
👤 NPC管理  ← 新增
```

### 主视图：NPC 卡片网格

参照地图卡片布局：
```
┌──────────────────────┐  ┌──────────────────────┐
│ 村长                  │  │ 铁匠老张              │
│ quest_giver          │  │ shop | weapon        │
│ 任务: 5个             │  │ 商品: 6个             │
│ 出现: 1个房间          │  │ 出现: 1个房间          │
│ 服务: rest, rumor     │  │ 服务: repair, forge  │
└──────────────────────┘  └──────────────────────┘
```

- 按 type 分组（卡片上方有类型筛选标签）
- 每张卡片显示：名称、类型、关键数据摘要
- 搜索框支持 ID / 名称模糊匹配

### 编辑弹窗

根据 type 动态展示不同区域：

```
┌─ 编辑 NPC ──────────────────────────┐
│ id       [npc_village_chief]         │  ← 新建时可编辑
│ 名称     [村长]                       │
│ 描述     [村庄的老村长，慈祥而睿智。]    │
│ 类型     [quest_giver ▼]             │  ← 切换类型影响下方表单
│─────────────────────────────────────│
│ 🏠 出现房间                           │
│ [稻香村广场 ×] [+ 添加房间]           │  ← 复用地图模块的 allRoomNames
│─────────────────────────────────────│
│ 💬 对话配置                           │
│ greeting: [年轻人，欢迎...] [+行]     │
│ quest_available: [最近村外...]       │
│ [+ 添加对话键]                        │
│─────────────────────────────────────│
│ ←—— 以下根据 type 动态显示 ——→       │
│                                      │
│ 🎒 关联任务 (quest_giver)            │
│ [quest_talk_chief ×] [+ 添加任务]    │
│                                      │
│ 🛒 商店配置 (shop)                   │
│ 类型: [weapon ▼]                    │
│ 商品: [iron_sword ×] [+ 添加物品]   │
│                                      │
│ 📚 可教技能 (trainer)                │
│ [basic_sword ×] [+ 添加技能]        │
│                                      │
│ 🔧 服务列表 (service/shop/trainer)   │
│ [rest ×] [rumor ×] [+ 添加服务]     │
│                                      │
│ 🚪 传送目标 (teleport)               │
│ [少林寺 ×] [+ 添加目标]              │
│                                      │
│ 🏛 所属门派 (faction)                │
│ [shaolin ▼]                         │
└──────────────────────────────────────┘
```

### 关联视图（点击卡片展开）

```
┌─ 村长 关联详情 ──────────────────────┐
│ 出现房间: 稻香村广场                   │
│ 关联任务:                             │
│   quest_talk_chief → 与村长对话       │
│   quest_kill_boars → 清理野猪         │
│ 对话: greeting ×4, quest_* ×3        │
│ 服务: —                               │
└──────────────────────────────────────┘
```

---

## 三、后端路由

参照地图路由模式，在 `gmController.js` 新增：

```
GET    /gm/config/npcs              ← 已有（getNpcList）
POST   /gm/config/npcs              ← 新增（createNpcConfig）
PUT    /gm/config/npcs/:npcId       ← 新增（updateNpcConfig）
DELETE /gm/config/npcs/:npcId       ← 新增（deleteNpcConfig）
```

### 删除 NPC 的关联处理

删除 NPC 时需要同步清理：
- 该 NPC 所在房间的 `npcs[]` 列表（`rooms.json`）
- 不删关联任务/物品/技能（仅解除引用）

### 创建/更新 NPC 时

- 如果 `roomIds` 有变化，同步更新对应房间的 `npcs[]`

---

## 四、前端实现（Admin.vue）

### 新增状态

```js
const npcConfigs = ref([])        // 所有 NPC
const npcTypeFilter = ref('')     // 类型过滤
const npcSearch = ref('')         // 搜索关键词
const showNpcEditor = ref(false)  // 编辑弹窗
const editingNpc = ref({})        // 当前编辑的 NPC
const isNewNpc = ref(false)       // 新建/编辑模式
const npcExpanded = ref(null)     // 展开查看关联的 NPC ID
```

### 新增函数

```js
loadNpcConfigs()          // 加载 NPC 列表（含统计）
openNpcEditor(npc?)       // 打开编辑弹窗（npc 为空=新建）
saveNpcConfig()           // 保存（POST 或 PUT）
deleteNpcConfig(id)       // 删除（含确认+关联清理提示）
filterNpcConfigs()        // computed: 按类型+搜索过滤
```

### 可复用的地图模块模式

| 地图模块 | NPC 模块对应 |
|----------|------------|
| `maps` + `mapRooms` 状态 | `npcConfigs` 状态 |
| `selectMap()` → 展开详情 | `npcExpanded` 展开关联 |
| `editingRoom` + `showRoomEditor` | `editingNpc` + `showNpcEditor` |
| `refreshAfterRoomCRUD()` | `loadNpcConfigs()` 刷新 |
| `allRoomNames` 查找表 | 复用（显示 NPC 出现房间名） |
| `allNpcs` + `filteredNpcs` | 已有，可重构独立使用 |
| `DIR_OPTIONS` 常量 | 无需（NPC 没有方向） |

---

## 五、对话编辑器设计

NPC 的 `dialogues` 字段是一个对象：
```json
{
  "greeting": ["...", "..."],
  "quest_available": "...",
  "rest": "..."
}
```

编辑方式：按 key-value 列表展示，每个 key 下可有多行 text（数组）或单行（字符串）：
- `greeting` → 多行文本，每行一个 `<textarea>`
- 其他键 → 单行 `<textarea>`
- 支持添加/删除对话键

---

## 六、统计面板（可选）

在 NPC 列表上方增加统计栏：
```
总NPC: 299 | quest_giver: 32 | shop: 40 | trainer: 37 | service: 170 | ...
```

---

## 七、实施步骤

| 步骤 | 内容 | 预计改动 |
|------|------|---------|
| 1 | `gmController.js` 新增 createNpcConfig / updateNpcConfig / deleteNpcConfig | ~60行 |
| 2 | `routes/index.js` 注册 3 条新路由 | ~5行 |
| 3 | `Admin.vue` 新增 NPC 管理 Tab：菜单项 + 卡片视图 + 搜索/过滤 | ~100行模板 |
| 4 | `Admin.vue` 新增 NPC 编辑弹窗（含对话编辑器+类型动态表单） | ~150行模板 |
| 5 | `Admin.vue` 新增 NPC 关联视图（展开卡片看详情） | ~50行模板 |
| 6 | `Admin.vue` 新增 JS 逻辑（状态/API调用/CRUD函数） | ~120行脚本 |
| 7 | 测试验证 + 构建 | — |

---

## 八、暂不做的

- ❌ 对话内容的富文本/条件脚本（当前纯文本足够）
- ❌ NPC 之间的关联关系
- ❌ NPC 刷新时间/出现概率
- ❌ NPC 总览图（后续参照 SVG 规范单独做）
- ❌ 批量导入/导出

---

*请确认以上规划是否合理，有无需要调整的地方。*
