#!/bin/bash

# 侠客行游戏启动脚本

echo "========================================"
echo "  侠客行 - 武侠MUD游戏"
echo "========================================"

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "Node版本: $(node -v)"

# 项目目录
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 启动后端
echo ""
echo "启动后端服务器..."
cd "$PROJECT_DIR/server"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi

# 启动后端（后台运行）
npm start &
SERVER_PID=$!
echo "后端进程ID: $SERVER_PID"

# 等待后端启动
sleep 3

# 启动前端
echo ""
echo "启动前端服务器..."
cd "$PROJECT_DIR/client"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 启动前端
npm run dev &
CLIENT_PID=$!
echo "前端进程ID: $CLIENT_PID"

echo ""
echo "========================================"
echo "  启动完成！"
echo "========================================"
echo ""
echo "游戏地址: http://localhost:5173"
echo "API地址: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 等待用户按Ctrl+C
trap "echo '停止服务...'; kill $SERVER_PID $CLIENT_PID; exit 0" INT
wait