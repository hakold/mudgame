# 侠客行 MUD 测试套件

## 快速开始

```bash
# 运行全部测试（无需服务器）
node tests/run_all.js

# 仅配置验证
node tests/run_all.js --config

# 仅游戏逻辑测试（需要MongoDB）
node tests/run_all.js --game

# 全流程集成测试（需要启动服务器）
node tests/run_all.js --full
```

## 测试模块

| 模块 | 文件 | 说明 | 需要服务器 |
|------|------|------|-----------|
| 配置验证 | config.test.js | JSON一致性、引用完整性 | ❌ |
| 游戏逻辑 | game.test.js | 战斗/任务/物品逻辑 | ❌ (需MongoDB) |
| REST API | api.test.js | 认证/CRUD接口 | ✅ |
| Socket集成 | socket.test.js | 全流程端到端 | ✅ |

## 开发规范

每次开发完成后必须：
1. 运行 `node tests/run_all.js` 确保已有测试通过
2. 根据本次变更添加新测试用例到对应模块
3. 记录新用例到本文件末尾的「测试用例登记表」
