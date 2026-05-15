# 侠客行 - 武侠MUD游戏

## 项目简介

侠客行是一款基于Web的文字RPG游戏，采用武侠小说世界观，玩法参考北大侠客行MUD游戏。

## 技术栈

- **前端**: Vue 3 + Vite + Socket.io-client
- **后端**: Node.js + Express + Socket.io
- **数据库**: MongoDB
- **缓存**: Redis

## 项目结构

```
Gameproject/
├── client/                 # Vue前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── components/    # 公共组件
│   │   ├── stores/        # Pinia状态管理
│   │   ├── router/        # 路由配置
│   │   └── assets/        # 静态资源
│   └── package.json
│
├── server/                 # Node.js后端
│   ├── src/
│   │   ├── models/        # 数据模型
│   │   ├── controllers/   # 控制器
│   │   ├── routes/        # 路由
│   │   ├── services/      # 服务层
│   │   ├── socket/        # WebSocket处理
│   │   ├── game/          # 游戏逻辑
│   │   └── scripts/       # 脚本
│   └── package.json
│
├── config/                 # 游戏配置
│   ├── excel/             # Excel配置源文件
│   └── json/              # JSON配置文件
│
└── doc/                    # 文档
    ├── 部署指南.md
    ├── 游戏说明.md
    └── 配置说明.md
```

## 功能特性

### 核心玩法
- ✅ 角色创建（门派、属性分配）
- ✅ 移动探索（地图、房间）
- ✅ 战斗系统（NPC战斗、PVP）
- ✅ 技能系统（武功学习、修炼）
- ✅ 物品系统（装备、道具、背包）
- ✅ 任务系统
- ✅ 社交系统（聊天、组队）
- ✅ 经济系统（商店、交易）

### 管理功能
- ✅ GM后台（玩家管理、物品发放、公告发布）
- ✅ 配置后台（地图、NPC、物品、技能配置）
- ✅ 数据统计

## 默认账号

| 账号类型 | 用户名 | 密码 | 说明 |
|---------|--------|------|------|
| 管理员 | admin | admin123 | 拥有最高权限 |
| GM | gamemaster | gm123456 | 游戏管理员权限 |

## 快速开始

详见 [部署指南.md](./部署指南.md)