# AI 协作进度同步 — 2026-05-27

> **本文档写给后续接手此项目的 AI 协作者**
> 阅读方式：从"当前状态"开始了解全貌，从"范例：地图管理模块"学习规范。

---

## 当前状态

### 环境

```
主机: Ubuntu 24.04 | Node.js v22.22.2 | MongoDB 8.0.23 (systemd) | Redis (apt)
公网IP: 159.75.98.60（腾讯云安全组未开放 3000/5173，仅本地调试）
```

### 服务

| 服务 | 端口 | 启动方式 | 状态 |
|------|------|---------|------|
| 后端 Express+Socket.IO | 3000 | `cd server && node src/app.js` | ✅ |
| 前端 Vite HMR | 5173 | `cd client && npx vite --host 0.0.0.0` | ✅ |

### 项目结构

```
mudgame/
├── config/json/          ← 所有游戏配置数据（关键！）
│   ├── maps.json         ← 4张地图：稻香村、迷雾森林、青云山、洛阳城
│   ├── rooms.json        ← 47个房间（含新旧混用ID，见下方注意事项）
│   ├── npcs.json         ← 252个NPC
│   ├── monsters.json     ← 129个怪物
│   ├── items.json        ← 272个道具
│   ├── skills.json       ← 90个功法
│   ├── quests.json       ← 54个任务
│   └── factionQuests.json← 41个门派任务
├── server/
│   ├── src/
│   │   ├── app.js              ← Express入口
│   │   ├── controllers/
│   │   │   └── gmController.js ← GM后台API（地图/房间/任务/道具 CRUD）
│   │   ├── game/
│   │   │   └── index.js        ← 游戏配置内存缓存（getConfigArray/reloadConfigSection）
│   │   ├── routes/index.js     ← 路由注册（/api前缀）
│   │   └── socket/index.js     ← 核心游戏逻辑
│   └── scripts/
│       └── generate-svg-overview.js ← SVG总览图生成器
├── client/
│   ├── src/
│   │   └── views/
│   │       └── Admin.vue        ← GM后台主界面（地图管理模块为重点）
│   └── public/
│       └── map-overview.svg     ← 自动生成的地图总览图
├── ai_read/                     ← AI协作者消息（本文档所在目录）
└── backups/                     ← 配置备份
```

---

## ⚠️ 已知问题 & 注意事项

### 1. 新旧房间 ID 混用
当前 `rooms.json` 中同时存在新旧两套 ID 体系：
- **新ID**：`Daoxiang_village_center`、`Cloud_forest_outside`、`Qingyun_mountain_side`、`Luoyang_city_center`
- **旧ID**：`village_center`、`mountain_path`、`city_gate`、`forest_deep` 等（mapId 为 `mountain`/`city`/`forest` 等不存在的旧地图）
- 旧ID房间仍有出口引用（如 `mountain_path` → `city_gate`），但所属地图已不存在
- **SVG 生成器会跳过这些孤立房间的跨图连线**

### 2. 入口房间（entryRoom）不是游戏功能
- `entryRoom` 仅是 GM 参考字段，不做移动逻辑
- 地图间穿越完全靠房间出口（exits）中的跨地图连线实现
- 游戏引擎 `socket/index.js` 不使用 `maps.json` 的 `entryRoom`

### 3. API 路由前缀
- 所有 API 路由挂在 `/api` 下：`app.use('/api', routes)`
- Vite dev server 代理 `/api` → `localhost:3000`
- 前端 `axios.defaults.baseURL = '/api'`，所以直接写 `/gm/config/maps` 即可

---

## 🏆 范例：地图管理模块（GM后台最佳实践）

这是**已完成并验证通过**的模块，后续 NPC/怪物/技能管理等模块都应参照此标准。

### 架构分层

```
前 端 (Admin.vue)        ← Vue 3 Composition API，一文件包含三大块
  ├── 模板（卡片视图 + 弹窗编辑器 + 全貌SVG）
  ├── 脚本（状态管理 + API调用 + 数据缓存策略）
  └── 样式（深色 MUD 风格）

路由层 (routes/index.js)  ← Express Router
  ├── GET/POST/PUT/DELETE 注册
  └── gmMiddleware 权限控制

控制器 (gmController.js)  ← 业务逻辑
  ├── getConfigArray('maps'/'rooms')  ← 从内存读（不是磁盘！）
  ├── writeConfig(filename, data)     ← 写入磁盘 + reloadConfigSection(内存同步)
  └── scheduleSvgRegen()              ← 1秒防抖自动更新SVG

数据层 (game/index.js)    ← 配置内存缓存
  ├── getConfigArray(key)             ← 纯内存读取
  ├── reloadConfigSection(key)        ← 写后立即同步内存
  └── getItem(id)                     ← 单道具查询
```

### 关键设计决策

#### 1. 从内存读、不读磁盘（避免 IO 风暴）
```js
// ❌ 旧代码：每次 API 调用都 readFileSync
function readConfig(filename) { return JSON.parse(fs.readFileSync(...)); }

// ✅ 新代码：纯内存访问
const maps = getConfigArray('maps');  // 零磁盘IO
```

#### 2. 写入时同步内存
```js
function writeConfig(filename, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  reloadConfigSection(filename);  // ← 关键：立即同步内存
}
```

#### 3. 前端缓存策略（解决数据滞后）
```js
// ❌ 多个相互覆盖的缓存 → 数据不一致
const exitRoomCache = ref({});   // 过期数据
const mapsRoomNames = ref({});   // 逻辑错误

// ✅ 统一查找表 + 全量刷新
const allRoomsLookup = ref({});  // roomId → { mapId, room }
const allRoomNames = ref({});    // roomId → name

// CRUD 后统一入口
async function refreshAfterRoomCRUD() {
  exitRoomCache.value = {};
  allRoomsLookup.value = {};
  await loadRoomsForMap(selectedMap.value.id);
  await loadMaps();
  // 同步 selectedMap 引用
  const updated = maps.value.find(m => m.id === selectedMap.value.id);
  if (updated) selectedMap.value = JSON.parse(JSON.stringify(updated));
}
```

#### 4. 跨地图操作隔离
```js
// ❌ 编辑房间出口时，加载目标地图房间覆盖了当前地图列表
function onExitMapChange(i) {
  loadRoomsForMap(exit.targetMapId);  // mapRooms.value 被替换！
}

// ✅ onlyCache 参数：仅缓存，不覆盖显示
function onExitMapChange(i) {
  loadRoomsForMap(exit.targetMapId, { onlyCache: true });
}
```

#### 5. 错误可见性
```js
// ❌ 静默吞错 → 用户看到空弹窗不知原因
async function loadAllNpcs() {
  try { allNpcs.value = (await axios.get('/gm/config/npcs')).data.data } catch(e) {}
}

// ✅ 有错误提示
async function loadAllNpcs() {
  try { allNpcs.value = (await axios.get('/gm/config/npcs')).data.data }
  catch(e) { alert('加载NPC列表失败: ' + (e.response?.data?.message || e.message)) }
}
```

### 已完成功能清单

| 功能 | 状态 |
|------|------|
| 地图卡片展示（入口房间名、房间数） | ✅ |
| 创建/编辑/保存地图 | ✅ |
| 房间 CRUD（含出口方向配置、NPC/怪物绑定） | ✅ |
| 跨地图出口选择（不覆盖当前地图列表） | ✅ |
| NPC/怪物选择弹窗（搜索、多选、权重配置） | ✅ |
| 自动功能聚合（NPC 服务显示） | ✅ |
| SVG 总览图 + 自动刷新 | ✅ |
| IO 优化（内存读取） | ✅ |

### 路由清单

```
GET    /gm/config/maps          ← 地图列表（含 roomCount 统计）
POST   /gm/config/maps          ← 创建地图
PUT    /gm/config/maps/:mapId   ← 更新地图
GET    /gm/config/rooms         ← 房间列表（支持 ?mapId= 过滤）
POST   /gm/config/rooms         ← 创建房间（自动同步 maps.json 的 rooms[]）
PUT    /gm/config/rooms/:roomId ← 更新房间
DELETE /gm/config/rooms/:roomId ← 删除房间（自动同步 maps.json）
GET    /gm/config/npcs          ← NPC 列表
GET    /gm/config/monsters      ← 怪物列表
```

### SVG 总览图

- **生成器**：`server/scripts/generate-svg-overview.js`
- **输出**：`client/public/map-overview.svg`（29KB）
- **触发**：每次地图/房间 CRUD 后 1 秒防抖自动重新生成
- **前端**：`Admin.vue` 全貌视图直接 `<img src="/map-overview.svg">`
- **规范**：参考 `SVG生成规范-给其他AI.md`（黑底、绿线地图内、橙色虚线跨地图、入口高亮、孤立房间区）

---

## 🎯 下一步：NPC 管理

按照地图管理模块的标准，接下来需要完成：

1. **NPC 卡片展示**（类似地图卡片）
2. **NPC CRUD 弹窗**（编辑 ID/名称/类型/对话/服务/关联任务/出现房间）
3. **房间绑定**（在房间编辑器中选 NPC，已基本完成）
4. **NPC 总览视图**（SVG 或类似形式）
5. **IO 优化**（确保 NPC 读取走内存 `getConfigArray`）

### 可复用的模式

- `Admin.vue` 的地图管理Tab 结构 → 新写一个 NPC 管理Tab
- `gmController.js` 的 `writeConfig` + `reloadConfigSection` 模式 → 复用
- `allRoomNames` / `allRoomsLookup` 查找表模式 → 新建 NPC 类似的查找表
- `loadRoomsForMap({ onlyCache })` 的跨上下文缓存隔离 → NPC-房间关联同理

---

## 📝 历史修复记录

| 提交 | 内容 |
|------|------|
| 742d900 | 四项Bug修复：入口卡片、跨地图背景切换、NPC弹窗空、IO风暴 |
| 188b7c0 | SVG总览图生成器 + 自动刷新 + 前端集成 |

---

*本文档由 AI 协作者 Hermes 生成，供后续 AI 协作者阅读。*
*最后更新: 2026-05-27 16:35 UTC*
