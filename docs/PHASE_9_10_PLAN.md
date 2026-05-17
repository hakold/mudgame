# Phase 9-10 详细规划

> Phase 9: 游戏后台管理系统（GM后台全面升级）
> Phase 10: 防作弊与安全维护
> 创建时间: 2026-05-16

---

## Phase 9：游戏后台管理系统

> 目标：将现有简陋后台升级为完整的游戏运营后台，支持配置管理、玩家管理、行为审计
> 现有后台只有5个菜单（玩家管理/公告管理/数据统计/战斗日志/地图管理），功能非常基础

### 9.1 配置任务管理

> 让GM可以在后台直接增删改查任务配置，无需手动编辑JSON文件

**文件**: 
- 新增 `server/src/controllers/configController.js` — 配置CRUD API
- 修改 `server/src/routes/index.js` — 添加配置管理路由
- 修改 `client/src/views/Admin.vue` — 添加任务配置页面

**实现**:
- 任务列表：分页展示 quests.json 中所有任务
- 任务编辑：表单编辑任务属性（名称/描述/类型/目标/奖励/前置任务）
- 任务新增：创建新任务并写入配置
- 任务删除：删除任务（检查是否有玩家正在进行）
- 任务启用/禁用：临时关闭某个任务而不删除
- 任务排序：拖拽调整任务顺序
- 批量导入/导出：JSON文件上传下载

**API设计**:
```
GET    /gm/config/quests          — 获取任务列表
POST   /gm/config/quests          — 创建新任务
PUT    /gm/config/quests/:id      — 更新任务
DELETE /gm/config/quests/:id      — 删除任务
PATCH  /gm/config/quests/:id/toggle — 启用/禁用
POST   /gm/config/quests/import   — 批量导入
GET    /gm/config/quests/export   — 批量导出
```

**数据流**:
1. 读取 config/json/quests.json → 展示列表
2. 编辑后写入 config/json/quests.json
3. 通知游戏服务热重载配置（无需重启）
4. 记录操作日志到 ActionLog

### 9.2 配置道具管理

> 管理所有物品配置，包括武器/防具/消耗品/材料

**文件**:
- 复用 `server/src/controllers/configController.js`
- 修改 `client/src/views/Admin.vue` — 添加道具配置页面

**实现**:
- 道具列表：按类型筛选（武器/防具/消耗品/材料/任务物品）
- 道具编辑：表单编辑属性（名称/描述/类型/价格/效果/等级要求/耐久度）
- 道具新增：创建新道具
- 道具删除：检查是否有玩家持有/怪物掉落引用
- 道具预览：显示道具详细信息卡片
- 掉落配置：关联怪物掉落表
- 商店配置：关联NPC商店商品

**API设计**:
```
GET    /gm/config/items           — 获取道具列表（支持type筛选）
POST   /gm/config/items           — 创建新道具
PUT    /gm/config/items/:id       — 更新道具
DELETE /gm/config/items/:id       — 删除道具
GET    /gm/config/items/:id/refs  — 查看道具被引用情况（掉落/商店/任务）
```

**道具属性编辑表单**:
- 基础：id, name, description, type, subtype, price, sellPrice
- 战斗：attack, defense, hpBonus, mpBonus
- 限制：requireLevel, requireClass, requireFaction
- 耐久：durability.max
- 效果：effects[] (type, value, duration)
- 堆叠：stackable, maxStack

### 9.3 配置地图管理

> 管理地图区域和房间，支持可视化编辑

**文件**:
- 复用 `server/src/controllers/configController.js`
- 修改 `client/src/views/Admin.vue` — 升级地图管理页面

**实现**:
- 地图列表：展示所有地图区域（名称/等级范围/房间数）
- 地图编辑：修改地图属性（名称/描述/等级范围/天气）
- 房间列表：按地图筛选房间
- 房间编辑：修改房间属性（名称/描述/出口/NPC/怪物/服务）
- 房间连接：可视化编辑房间出口连接
- 房间新增/删除
- 地图统计：每个地图的怪物/NPC/玩家分布

**API设计**:
```
GET    /gm/config/maps            — 获取地图列表
PUT    /gm/config/maps/:id        — 更新地图
POST   /gm/config/maps            — 创建新地图
DELETE /gm/config/maps/:id        — 删除地图
GET    /gm/config/rooms           — 获取房间列表（支持mapId筛选）
PUT    /gm/config/rooms/:id       — 更新房间
POST   /gm/config/rooms           — 创建新房间
DELETE /gm/config/rooms/:id       — 删除房间
GET    /gm/config/maps/:id/stats  — 地图统计
```

**房间连接可视化**:
- 简化版：表格形式展示出口连接（当前房间→方向→目标房间）
- 进阶版（可选）：Canvas绘制房间节点图，拖拽连线

### 9.4 查看当前玩家

> 升级现有玩家管理，提供更完整的玩家信息查看

**文件**:
- 修改 `server/src/controllers/gmController.js` — 扩展玩家查询
- 修改 `client/src/views/Admin.vue` — 升级玩家管理页面

**实现**:
- 玩家列表增强：
  - 筛选：等级范围/门派/在线状态/注册时间
  - 排序：等级/金币/经验/注册时间
  - 批量操作：批量发金币/批量封禁
- 玩家详情页（点击进入）：
  - 基础信息：角色名/等级/门派/声望/金币/经验
  - 属性详情：五维属性/HP/MP/攻击/防御/闪避
  - 装备栏：当前装备的6个槽位+耐久度
  - 背包物品：所有物品列表+数量
  - 已学技能：技能列表+等级+经验
  - 任务进度：进行中/已完成任务
  - 位置信息：当前地图/房间
  - 活跃度：最后登录/在线时长/战斗次数
- 玩家搜索：支持角色名/用户名/邮箱模糊搜索

**API设计**:
```
GET    /gm/players/:id            — 获取玩家完整信息
GET    /gm/players/:id/equipment  — 获取玩家装备
GET    /gm/players/:id/skills     — 获取玩家技能
GET    /gm/players/:id/quests     — 获取玩家任务
GET    /gm/players/:id/inventory  — 获取玩家背包
GET    /gm/players/:id/activity   — 获取玩家活跃数据
```

### 9.5 调整玩家属性

> GM直接修改玩家属性，支持精细调整

**文件**:
- 修改 `server/src/controllers/gmController.js` — 扩展属性修改
- 修改 `client/src/views/Admin.vue` — 添加属性调整面板

**实现**:
- 基础属性调整：
  - 等级（±调整，自动重算HP/MP上限）
  - 经验值（±调整）
  - 金币（±调整）
  - 五维属性（力量/敏捷/体质/悟性/根骨，±调整）
  - freePoints（±调整）
- 战斗属性调整：
  - HP当前/最大（直接设置）
  - MP当前/最大（直接设置）
- 门派属性调整：
  - 门派（强制加入/退出门派）
  - 门派等级（强制进阶/降级）
  - 声望/贡献（±调整）
- 位置调整：
  - 传送玩家到指定房间
- 物品操作：
  - 发放物品（选择物品+数量）
  - 扣除物品（选择背包物品+数量）
  - 发放金币（已有，保留）
- 技能操作：
  - 授予技能（选择技能+等级）
  - 移除技能
- 状态操作：
  - 封禁/解封（已有，保留）
  - 重置位置（卡住时传送回村）
  - 重置状态（dead→online）
  - 清除buff

**安全措施**:
- 所有修改操作记录到 ActionLog
- 敏感操作（封禁/扣除/重置）需要二次确认
- 批量操作需要额外权限验证

**API设计**:
```
PUT    /gm/players/:id/attributes   — 修改基础属性
PUT    /gm/players/:id/combat       — 修改战斗属性
PUT    /gm/players/:id/faction      — 修改门派属性
PUT    /gm/players/:id/location     — 传送玩家
POST   /gm/players/:id/items        — 发放物品
DELETE /gm/players/:id/items/:invId — 扣除物品
POST   /gm/players/:id/skills       — 授予技能
DELETE /gm/players/:id/skills/:id   — 移除技能
POST   /gm/players/:id/reset        — 重置状态
```

### 9.6 玩家行为日志（可过滤）

> 记录和查询玩家所有重要行为，用于运营分析和问题排查

**文件**:
- 新增 `server/src/models/ActionLog.js` — 行为日志模型
- 新增 `server/src/game/actionLogService.js` — 日志记录服务
- 修改 `server/src/socket/index.js` — 在关键事件中记录日志
- 修改 `server/src/controllers/gmController.js` — 添加日志查询API
- 修改 `client/src/views/Admin.vue` — 添加行为日志页面

**ActionLog 数据模型**:
```javascript
{
  timestamp: Date,          // 操作时间
  userId: ObjectId,         // 操作用户ID
  characterName: String,    // 角色名（冗余，方便查询）
  category: String,         // 分类：combat/trade/chat/movement/economy/skill/quest/faction/system
  action: String,           // 具体动作：kill/die/buy/sell/trade/move/learn/levelup/...
  details: Mixed,           // 详情（JSON，根据action不同结构不同）
  roomId: String,           // 发生位置（可选）
  targetUserId: ObjectId,   // 目标用户（交易/PVP等，可选）
  ipAddress: String,        // IP地址
  sessionId: String         // 会话ID
}
```

**日志分类与动作**:
| 分类 | 动作 | 详情内容 |
|------|------|----------|
| combat | kill, die, flee, pvp_kill, pvp_die | 怪物/玩家ID, 获得经验/金币, 掉落物品 |
| economy | buy, sell, trade, repair, forge, give_gold | 物品ID, 数量, 金额 |
| movement | move, teleport | 从哪到哪 |
| skill | learn, upgrade, use | 技能ID, 等级变化 |
| quest | accept, complete, abandon | 任务ID, 奖励 |
| faction | join, leave, advance, task | 门派ID, 声望变化 |
| chat | chat_world, chat_room, chat_private | 频道, 内容摘要 |
| system | login, logout, register, ban, unban | IP, 设备信息 |
| gm_action | modify_player, give_item, ban, teleport | GM操作详情 |

**日志过滤功能**:
- 按玩家：输入角色名查看该玩家所有行为
- 按分类：选择 combat/economy/movement/... 过滤
- 按动作：选择 kill/buy/sell/... 过滤
- 按时间：选择时间范围
- 按位置：选择房间ID
- 组合过滤：多条件AND查询
- 关键词搜索：在details中搜索
- 导出：导出CSV/JSON

**API设计**:
```
GET  /gm/action-logs              — 查询日志（支持所有过滤参数）
GET  /gm/action-logs/stats        — 日志统计（按分类/动作聚合）
GET  /gm/action-logs/export       — 导出日志
```

**查询参数**:
```
?userId=xxx&category=combat&action=kill
&startTime=2026-05-01&endTime=2026-05-16
&roomId=village_center&keyword=金币
&page=1&limit=50&sort=-timestamp
```

### 9.7 配置热重载机制

> 修改配置后无需重启服务器，自动生效

**文件**:
- 修改 `server/src/game/index.js` — 添加配置热重载
- 修改 `server/src/controllers/configController.js` — 修改后触发重载

**实现**:
- 配置文件监听：fs.watch 监控 config/json/ 目录变化
- 内存缓存刷新：修改JSON文件后自动重新加载到内存
- 通知客户端：通过Socket.IO广播配置更新事件
- 版本号管理：每次配置变更递增版本号，客户端可检测过期
- 回滚机制：保留最近5个配置版本，支持一键回滚

### 9.8 后台Dashboard总览

> 后台首页，一眼掌握游戏运营状态

**文件**:
- 修改 `client/src/views/Admin.vue` — 添加Dashboard页面

**实现**:
- 核心指标卡片：
  - 在线玩家数 / 总注册数
  - 今日新增 / 今日活跃
  - 今日战斗次数 / 今日交易次数
  - 服务器运行时间
- 趋势图表（最近7天）：
  - 日活趋势
  - 新增用户趋势
  - 金币流通量
- 实时动态：
  - 最近10条行为日志（滚动显示）
  - 当前在线玩家列表
- 快捷操作：
  - 发布公告
  - 全服广播
  - 服务器维护模式

---

## Phase 10：防作弊与安全维护

> 目标：建立完整的防作弊体系，保护游戏公平性和数据安全
> 这一块需要从攻击者视角思考，覆盖常见作弊手段

### 10.1 输入验证与请求校验

> 第一道防线：所有客户端输入都不可信

**文件**:
- 新增 `server/src/middleware/validation.js` — 通用验证中间件
- 新增 `server/src/middleware/rateLimiter.js` — 请求频率限制
- 修改 `server/src/socket/index.js` — 添加输入验证

**实现**:

#### 10.1.1 Socket事件输入验证
- 所有socket事件接收的数据必须经过schema验证
- 使用 Joi 或自定义验证器校验：
  - `move`: direction 必须是有效方向字符串
  - `battle_start`: targetId 必须是合法ID，type 必须是 pve/pvp
  - `buy_item`: itemId 必须存在，quantity 必须 > 0 且 <= 99
  - `chat_*`: content 长度限制 1-500 字符，禁止HTML/脚本注入
  - `trade_*`: 交易金额不能为负，物品数量不能超过持有量
- 非法输入直接断开连接 + 记录日志

#### 10.1.2 请求频率限制
- Socket事件限频（每用户）：
  - 移动：5次/秒
  - 战斗行动：3次/秒
  - 聊天：5次/10秒
  - 交易：2次/秒
  - 其他：10次/秒
- 超频处理：警告→短暂禁言→断开连接
- HTTP API限频：
  - 登录：5次/分钟/IP
  - 注册：3次/小时/IP
  - GM操作：30次/分钟/用户

#### 10.1.3 请求完整性校验
- 关键操作添加请求时间戳，拒绝过期请求（>30秒）
- 防重放：关键操作添加nonce，服务端记录已用nonce
- 操作序列号：战斗/交易等流程维护状态机，拒绝乱序请求

### 10.2 服务端权威校验

> 核心原则：服务端是唯一真相来源，客户端只是展示

**文件**:
- 修改 `server/src/game/battleService.js` — 加强战斗校验
- 修改 `server/src/socket/index.js` — 全面服务端校验
- 新增 `server/src/game/validatorService.js` — 统一校验服务

**实现**:

#### 10.2.1 战斗防作弊
- **回合校验**：服务端严格维护当前回合，拒绝非当前回合的行动
- **技能校验**：每次使用技能验证：是否已学习→冷却是否结束→MP是否足够→是否在沉默/眩晕状态
- **伤害校验**：伤害计算完全在服务端，客户端无法篡改
- **行动时间**：检测异常快速操作（人类不可能的反应速度）
- **战斗状态**：非战斗状态拒绝战斗行动，战斗中拒绝非战斗操作

#### 10.2.2 经济防作弊
- **购买校验**：验证物品是否在当前商店出售→价格是否正确→金币是否足够→背包是否已满
- **出售校验**：验证物品是否在背包→数量是否足够→出售价格是否正确
- **交易校验**：双方物品/金币是否真实持有→交易是否在有效状态→双方是否在同一房间
- **金币校验**：每次金币变动前后校验总额平衡（防止并发导致金币复制）

#### 10.2.3 移动防作弊
- **路径校验**：验证目标房间是否与当前房间相邻（出口存在）
- **瞬移检测**：记录上次位置和时间，检测不可能的移动速度
- **房间权限**：某些房间需要等级/门派/任务条件，服务端强制校验

#### 10.2.4 属性防作弊
- **属性计算**：所有属性值由服务端根据基础属性+装备+buff计算，客户端无法篡改
- **升级校验**：经验值是否达到升级要求，由服务端判定
- **装备校验**：装备是否满足等级/门派要求，服务端强制校验

### 10.3 并发安全与数据一致性

> 防止利用并发请求复制物品/金币

**文件**:
- 新增 `server/src/game/lockService.js` — 分布式锁服务
- 修改关键业务逻辑添加锁

**实现**:

#### 10.3.1 用户级锁
- 每个用户同时只能执行一个关键操作（交易/购买/装备/拾取）
- 使用 Redis SETNX 实现分布式锁
- 锁超时：10秒自动释放（防止死锁）
- 获取锁失败：返回"操作太频繁，请稍后再试"

#### 10.3.2 乐观锁（MongoDB版本号）
- 关键文档（User/Inventory）添加 `__v` 版本号
- 更新时检查版本号，防止覆盖
- 冲突时重试或报错

#### 10.3.3 原子操作
- 金币变动使用 `$inc` 而非先读后写
- 物品转移使用 MongoDB 事务（如果支持）或两阶段提交
- 背包操作使用 `findOneAndUpdate` 原子操作

#### 10.3.4 余额校验
- 定期（每小时）运行余额校验任务
- 比对金币收入总和 vs 支出总和 + 当前余额
- 不一致时标记异常 + 通知GM
- 校验范围：金币/经验值/物品数量

### 10.4 会话安全

> 防止账号盗用和会话劫持

**文件**:
- 修改 `server/src/middleware/auth.js` — 增强认证安全
- 修改 `server/src/services/authService.js` — 添加安全策略
- 新增 `server/src/middleware/sessionSecurity.js` — 会话安全中间件

**实现**:

#### 10.4.1 JWT安全增强
- Token过期时间缩短：access_token 2小时，refresh_token 7天
- Token绑定IP：签发时记录IP，使用时校验IP变化（可选，移动网络可能频繁变化）
- Token绑定设备指纹：签发时记录User-Agent哈希
- 异地登录检测：新IP登录时发送通知（邮件/站内信）
- 单设备登录：同一账号同时只允许一个活跃Socket连接，新连接踢掉旧连接

#### 10.4.2 密码安全
- 密码复杂度要求：8位以上，包含字母+数字
- 登录失败次数限制：5次失败后锁定15分钟
- 密码哈希：bcrypt saltRounds=12（当前是10，提高）
- 密码修改需要验证旧密码

#### 10.4.3 注册安全
- 邮箱验证：注册后发送验证邮件（可选功能）
- 注册频率限制：同一IP每天最多注册3个账号
- 邀请码机制（可选）：限制注册渠道

### 10.5 异常行为检测

> 自动识别可疑行为模式

**文件**:
- 新增 `server/src/game/antiCheatService.js` — 反作弊检测服务
- 修改 `server/src/socket/index.js` — 接入检测

**实现**:

#### 10.5.1 行为基线
- 记录每个玩家的正常行为模式：
  - 平均每分钟操作次数
  - 平均战斗回合时间
  - 平均移动间隔
  - 常用命令分布
- 偏离基线超过3个标准差 → 标记可疑

#### 10.5.2 具体检测规则
- **加速检测**：移动/操作频率异常高（可能是加速器/脚本）
- **自动战斗检测**：战斗行动间隔极其规律（标准差极小，可能是宏/脚本）
- **金币异常**：短时间内金币大量增加（可能是利用bug复制）
- **经验异常**：经验获取速度远超正常（可能是利用bug刷怪）
- **位置异常**：瞬移/穿墙（可能是修改客户端）
- **交易异常**：大量异常交易（可能是洗金/小号养大号）
- **多开检测**：同一IP多个账号同时在线

#### 10.5.3 处理策略
- 可疑等级：1-5级
  - 1级（轻微）：记录日志，不干预
  - 2级（可疑）：记录日志，通知GM
  - 3级（较重）：限制部分功能（禁止交易/拍卖）
  - 4级（严重）：自动踢下线，通知GM
  - 5级（确凿）：自动临时封禁，等待GM审核
- 误判申诉：玩家可提交申诉，GM审核后解除

### 10.6 数据安全与备份

> 保护游戏数据不丢失、不被篡改

**文件**:
- 新增 `server/src/scripts/backup.js` — 备份脚本
- 新增 `server/src/scripts/restore.js` — 恢复脚本
- 新增 `server/src/scripts/integrityCheck.js` — 完整性校验

**实现**:

#### 10.6.1 数据库备份
- 自动备份：每天凌晨3点全量备份 MongoDB
- 增量备份：每4小时增量备份
- 备份保留：每日备份保留7天，每周备份保留4周，每月备份保留6月
- 备份存储：本地 + 远程（S3/OSS）
- 备份验证：每周自动恢复到测试环境验证可用性

#### 10.6.2 配置文件备份
- 每次修改配置前自动备份旧版本
- 保留最近20个版本
- 支持一键回滚到任意版本

#### 10.6.3 数据完整性校验
- 每日校验：
  - 用户金币余额 = 初始金币 + 所有收入 - 所有支出
  - 物品总数 = 所有用户背包物品 + 地面掉落 + 交易中物品
  - 经验值合理性：等级与累计经验匹配
- 不一致时自动标记 + 告警

#### 10.6.4 敏感数据保护
- 密码：bcrypt哈希，不可逆
- JWT密钥：环境变量存储，不硬编码
- 数据库连接：使用最小权限账号
- 日志脱敏：不记录密码、Token原文
- API响应：生产环境不暴露堆栈跟踪

### 10.7 通信安全

> 保护客户端-服务端通信安全

**文件**:
- 修改 `server/src/app.js` — HTTPS + 安全头
- 修改 `server/src/config/index.js` — 安全配置

**实现**:

#### 10.7.1 传输安全
- 生产环境强制 HTTPS/WSS
- HTTP → HTTPS 301重定向
- HSTS 头部
- TLS 1.2+ 最低版本

#### 10.7.2 HTTP安全头
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

#### 10.7.3 CORS严格配置
- 生产环境只允许指定域名
- 不使用 `corsOrigins: true`
- 限制允许的HTTP方法和头部

#### 10.7.4 Socket.IO安全
- 认证中间件验证每个连接
- 禁止未认证的Socket事件
- 连接超时：30秒未认证则断开
- 心跳检测：60秒无响应断开

### 10.8 GM操作安全

> 防止GM权限滥用

**文件**:
- 修改 `server/src/middleware/auth.js` — GM权限分级
- 新增 `server/src/middleware/gmAudit.js` — GM操作审计
- 修改 `server/src/controllers/gmController.js` — 添加审计日志

**实现**:

#### 10.8.1 GM权限分级
- **初级GM**：查看玩家信息、发布公告、查看日志
- **高级GM**：调整玩家属性、发放物品/金币、封禁玩家
- **管理员**：修改游戏配置、管理GM账号、系统设置
- 权限矩阵：每个API路由标注所需最低权限等级

#### 10.8.2 GM操作审计
- 所有GM操作记录到 ActionLog（category=gm_action）
- 记录内容：操作者、目标、操作类型、修改前后值、时间、IP
- 审计日志不可删除（只有管理员可查看）
- 敏感操作二次确认：封禁/删除/大量发放

#### 10.8.3 GM账号安全
- GM账号独立密码策略（更复杂）
- GM登录需要二次验证（可选：TOTP）
- GM操作超时：30分钟无操作自动登出
- GM操作频率限制：防止批量操作

---

## 执行计划

### Phase 9 执行顺序（预计5-7天）

**Batch 1 - 数据基础（Day 1-2）**:
1. **9.6 ActionLog模型+服务** — 后台所有功能依赖日志系统
2. **9.7 配置热重载机制** — 配置管理依赖热重载
3. **9.1 配置任务管理** — 第一个配置管理页面

**Batch 2 - 配置管理（Day 3-4）**:
4. **9.2 配置道具管理** — 第二个配置管理页面
5. **9.3 配置地图管理** — 升级现有地图管理

**Batch 3 - 玩家管理（Day 5-6）**:
6. **9.4 查看当前玩家** — 升级玩家管理
7. **9.5 调整玩家属性** — 扩展GM操作
8. **9.8 Dashboard总览** — 后台首页

### Phase 10 执行顺序（预计5-7天）

**Batch 1 - 基础防护（Day 1-2）**:
1. **10.1 输入验证与请求校验** — 第一道防线，最优先
2. **10.2 服务端权威校验** — 核心防作弊逻辑
3. **10.3 并发安全** — 防复制bug

**Batch 2 - 深层防护（Day 3-4）**:
4. **10.4 会话安全** — 账号安全
5. **10.5 异常行为检测** — 智能反作弊
6. **10.7 通信安全** — 传输层安全

**Batch 3 - 运维安全（Day 5-7）**:
7. **10.6 数据安全与备份** — 数据保护
8. **10.8 GM操作安全** — 权限管理

---

## 进度追踪

| Phase | 功能 | 状态 | 完成日期 |
|-------|------|------|----------|
| 9.1 | 配置任务管理 | ⬜ 待开始 | |
| 9.2 | 配置道具管理 | ⬜ 待开始 | |
| 9.3 | 配置地图管理 | ⬜ 待开始 | |
| 9.4 | 查看当前玩家 | ⬜ 待开始 | |
| 9.5 | 调整玩家属性 | ⬜ 待开始 | |
| 9.6 | 玩家行为日志 | ⬜ 待开始 | |
| 9.7 | 配置热重载机制 | ⬜ 待开始 | |
| 9.8 | Dashboard总览 | ⬜ 待开始 | |
| 10.1 | 输入验证与请求校验 | ⬜ 待开始 | |
| 10.2 | 服务端权威校验 | ⬜ 待开始 | |
| 10.3 | 并发安全与数据一致性 | ⬜ 待开始 | |
| 10.4 | 会话安全 | ⬜ 待开始 | |
| 10.5 | 异常行为检测 | ⬜ 待开始 | |
| 10.6 | 数据安全与备份 | ⬜ 待开始 | |
| 10.7 | 通信安全 | ⬜ 待开始 | |
| 10.8 | GM操作安全 | ⬜ 待开始 | |

---

*最后更新: 2026-05-16 02:30*
