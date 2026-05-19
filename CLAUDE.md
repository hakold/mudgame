# 侠客行 MUD 游戏 - AI 开发指引

## 项目架构
- **前端**: Vue 3 + Pinia + Vite (端口 5173)
- **后端**: Express + Socket.IO + Mongoose + Redis (端口 3000)
- **配置**: JSON 文件驱动 (config/json/)

## 关键文件
- `server/src/socket/index.js` — 核心游戏逻辑 (Socket.IO 事件处理)
- `server/src/game/` — 战斗/任务进度/成就/掉落等服务
- `server/src/models/` — Mongoose 模型 (User, Inventory, Quest 等)
- `client/src/stores/game.js` — Pinia 游戏状态管理 + sendCommand
- `client/src/views/Game.vue` — 游戏主界面组件
- `config/json/` — 所有游戏配置数据

## 装备系统
- 插槽: weapon, armor(body), helmet, boots, ring, accessory
- `getEquipmentSlot()` 在 socket/index.js:2653 处理 subtype 映射
- `isEquipmentItem()` 检查 type === 'weapon' || 'armor' || 'equipment'

## 门派系统
- 门派配置: factions.json (含 entryExamId)
- 门派任务: factionQuests.json (faction_entry / faction_rank_up / faction_daily / faction_collect)
- 进阶: disciple → deacon → elder → leader
- 贡献兑换: faction_exchange_list / faction_exchange socket 事件

## 任务系统
- 普通任务: quests.json, 通过 talk_npc → accept_quest → complete_quest 流程
- 门派任务: factionQuests.json, 通过 accept_quest (统一入口，自动识别)
- 任务进度: questProgressService.js 处理 kill/talk/visit/collect/learn_skill/join_faction 等类型

## 功法书
- 道具类型: skill_book (含 skillId + successRate)
- use_item handler 处理概率学习逻辑
- 支持 `use <物品名称>` 客户端命令

## 配置数据规模
rooms:164 / npcs:249 / monsters:129 / items:272 / skills:90 / quests:54 / factionQuests:41
