# 部署与开服手册

## 环境要求

| 组件 | 版本要求 |
|------|----------|
| Node.js | >= 18.x |
| MongoDB | >= 5.x |
| Redis | >= 6.x |
| npm | >= 9.x |

## 快速部署

### 1. 克隆仓库

```bash
git clone git@github.com:hakold/mudgame.git
cd mudgame
npm install
cd client && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
# 编辑 server/.env，修改以下关键配置：
```

**.env 关键配置项:**

```env
# 服务端口
PORT=3000
HOST=0.0.0.0

# 生产环境必须修改
NODE_ENV=production

# MongoDB (必须修改)
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DATABASE=wuxia_mud
MONGODB_USER=
MONGODB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT密钥 (生产环境必须修改为随机字符串)
JWT_SECRET=请修改为随机64位字符串
JWT_EXPIRES_IN=7d

# CORS (生产环境改为实际域名)
CORS_ORIGINS=http://localhost:5173
```

### 3. 初始化数据库

```bash
node server/src/scripts/initDatabase.js
```

此脚本会自动创建基础数据（地图、NPC、怪物、物品等）。

### 4. 构建前端（生产环境）

```bash
cd client
npm run build
cd ..
```

构建产物在 `client/dist/`。

### 5. 启动服务

**开发模式:**
```bash
# 终端1: 启动后端
npm run dev:server

# 终端2: 启动前端
cd client && npm run dev
```

**生产模式:**
```bash
# 后端直接运行
node server/src/index.js

# 前端静态文件由后端托管
# 或使用 nginx 代理
```

### 6. 验证服务

```bash
# 健康检查
curl http://localhost:3000/health

# 应返回
# {"status":"ok","game":"侠客行","version":"1.0.0"}
```

## 生产环境部署建议

### 使用 PM2 进程管理

```bash
npm install -g pm2
pm2 start server/src/index.js --name mudgame
pm2 save
pm2 startup
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## GM 后台使用

GM 后台地址: `http://your-domain/admin`

**GM 权限等级:**

| 等级 | role值 | 权限 |
|------|--------|------|
| 初级GM | `gm` | 查看玩家/公告/统计/日志 |
| 高级GM | `senior_gm` | + 修改玩家属性/封禁/发物品 |
| 管理员 | `admin` | + 修改游戏配置/管理GM账号 |

**设置GM权限:** 在 MongoDB 中修改用户 role 字段：

```bash
mongosh wuxia_mud
db.users.updateOne({ username: "你的账号" }, { $set: { role: "admin" } })
```

**后台功能菜单:**
- 📊 控制台 — 核心运营指标 + 7天日活趋势
- 👤 玩家管理 — 搜索/详情弹窗/GM操作
- 📋 行为日志 — 分类过滤查询所有玩家行为
- 📜 任务配置 — CRUD任务JSON
- 🎒 道具配置 — 按类型管理物品
- 🗺️ 地图管理 — 地图/房间/出口编辑
- 📢 公告管理 — 发布/删除公告
- ⚔️ 战斗日志 — 全服战斗记录

## 安全配置检查清单

开服前务必确认：

- [ ] `.env` 中 JWT_SECRET 已改为随机字符串
- [ ] `NODE_ENV=production`
- [ ] CORS_ORIGINS 已改为实际域名（不是 *）
- [ ] MongoDB 设置了用户名密码
- [ ] Redis 设置了密码
- [ ] HTTPS 证书已配置
- [ ] 防火墙已配置（仅开放必要端口）
- [ ] PM2 或 systemd 已配置进程守护

## 日常运维

### 数据备份

```bash
# MongoDB 全量备份
mongodump --db wuxia_mud --out /backup/$(date +%Y%m%d)

# 配置文件备份
cp -r config/json /backup/config-$(date +%Y%m%d)
```

### 查看日志

```bash
pm2 logs mudgame
```

### 监控可疑玩家

通过 GM 后台 → 行为日志 → 选择 category=system, action=anti_cheat 查看反作弊检测日志。

### 重启服务

```bash
pm2 restart mudgame
# 配置热重载已启用，修改 config/json/ 下的JSON文件无需重启
```

### 封禁玩家

1. 后台 → 玩家管理 → 找到玩家 → 点击"封禁"
2. 或者直接 MongoDB: `db.users.updateOne({ characterName: "角色名" }, { $set: { status: "banned" } })`

## 配置热重载

修改 `config/json/` 下任何 JSON 文件后，服务器会自动检测并重新加载，**无需重启**。

支持热重载的配置：maps, rooms, npcs, monsters, items, skills, quests, factions, factionQuests, achievements, forgeRecipes

---

*最后更新: 2026-05-19*
