# 侠客行 - 武侠MUD游戏

## 🎮 项目状态

✅ 项目结构已创建
✅ 后端代码已完成
✅ 前端代码已完成
✅ 游戏配置已完成
✅ 文档已编写
✅ 依赖已安装

## 📁 项目目录

```
~/Desktop/Gameproject/
├── client/                 # Vue前端
│   ├── src/
│   │   ├── views/         # 登录、游戏、管理后台页面
│   │   ├── stores/        # Pinia状态管理
│   │   ├── router/        # 路由配置
│   │   └── assets/        # 样式文件
│   └── package.json
│
├── server/                 # Node.js后端
│   ├── src/
│   │   ├── models/        # 数据模型（User, Inventory, Quest等）
│   │   ├── controllers/   # 控制器（认证、玩家、GM）
│   │   ├── routes/        # API路由
│   │   ├── services/      # 服务层
│   │   ├── socket/        # WebSocket实时通信
│   │   ├── game/          # 游戏逻辑（战斗系统）
│   │   └── scripts/       # 数据库初始化脚本
│   └── package.json
│
├── config/json/           # 游戏配置文件
│   ├── maps.json          # 地图配置
│   ├── rooms.json         # 房间配置
│   ├── npcs.json          # NPC配置
│   ├── monsters.json      # 怪物配置
│   ├── items.json         # 物品配置
│   ├── skills.json        # 技能配置
│   ├── quests.json        # 任务配置
│   └── factions.json      # 门派配置
│
├── doc/                   # 文档
│   ├── 部署指南.md        # 详细部署说明
│   ├── 游戏说明.md        # 游戏玩法说明
│   └── 配置说明.md        # 配置文件说明
│
├── start.sh               # Mac/Linux启动脚本
└── start.bat              # Windows启动脚本
```

## 🚀 快速启动

### 方式一：使用启动脚本

**Mac/Linux:**
```bash
cd ~/Desktop/Gameproject
./start.sh
```

**Windows:**
双击 `start.bat`

### 方式二：手动启动

**1. 启动后端:**
```bash
cd ~/Desktop/Gameproject/server
npm start
```

**2. 启动前端（新终端窗口）:**
```bash
cd ~/Desktop/Gameproject/client
npm run dev
```

**3. 访问游戏:**
打开浏览器访问 http://localhost:5173

## 🔧 初始化数据库

首次运行需要初始化数据库：

```bash
cd ~/Desktop/Gameproject/server
npm run init-db
```

这将创建：
- 管理员账号: admin / admin123
- GM账号: gamemaster / gm123456

## ⚙️ 配置数据库连接

编辑 `server/.env` 文件：

```env
# MongoDB配置
MONGODB_HOST=192.168.31.148
MONGODB_PORT=10055
MONGODB_DATABASE=wuxia_mud

# Redis配置
REDIS_HOST=192.168.31.148
REDIS_PORT=16379
```

## 📖 功能清单

### 核心玩法
- [x] 用户注册/登录
- [x] 角色创建（属性分配）
- [x] 地图探索（房间移动）
- [x] 战斗系统（PVE/PVP）
- [x] 技能系统（学习/使用）
- [x] 物品系统（装备/消耗品）
- [x] 任务系统
- [x] 社交系统（世界/房间/私聊）
- [x] 门派系统
- [x] 经济系统

### 管理功能
- [x] GM后台（玩家管理）
- [x] 公告管理
- [x] 数据统计
- [x] 战斗日志

### 配置功能
- [x] JSON配置文件
- [x] 可配置地图/房间/NPC/怪物/物品/技能/任务/门派

## 🌐 默认端口

| 服务 | 端口 |
|------|------|
| 前端 | 5173 |
| 后端API | 3000 |
| MongoDB | 10055（当前配置）|
| Redis | 16379（当前配置）|

## 📚 详细文档

- [部署指南](doc/部署指南.md) - 环境搭建和部署说明
- [游戏说明](doc/游戏说明.md) - 游戏玩法介绍
- [配置说明](doc/配置说明.md) - 配置文件修改指南

## 🎯 下一步

1. 启动MongoDB和Redis服务
2. 运行数据库初始化脚本
3. 启动后端和前端服务
4. 访问游戏并注册账号
5. 开始游戏！