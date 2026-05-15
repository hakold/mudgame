@echo off
chcp 65001 >nul
echo ========================================
echo   侠客行 - 武侠MUD游戏
echo ========================================

:: 检查Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未安装Node.js
    echo 请访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Node版本: %NODE_VERSION%

:: 项目目录
cd /d "%~dp0"

:: 启动后端
echo.
echo 启动后端服务器...
cd server

:: 检查依赖
if not exist "node_modules" (
    echo 安装后端依赖...
    call npm install
)

:: 启动后端
start "侠客行-后端" cmd /c "npm start"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 启动前端
echo.
echo 启动前端服务器...
cd ..\client

:: 检查依赖
if not exist "node_modules" (
    echo 安装前端依赖...
    call npm install
)

:: 启动前端
start "侠客行-前端" cmd /c "npm run dev"

echo.
echo ========================================
echo   启动完成！
echo ========================================
echo.
echo 游戏地址: http://localhost:5173
echo API地址: http://localhost:3000
echo.
echo 关闭此窗口不会停止服务
echo 要停止服务请关闭后端和前端窗口
echo.

pause