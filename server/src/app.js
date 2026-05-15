require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { createClient } = require('redis');

const config = require('./config');
const routes = require('./routes');
const socketHandler = require('./socket');
const { initGameSystems } = require('./game');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/static', express.static('public'));

// API路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    game: config.gameName,
    version: config.gameVersion,
    timestamp: new Date()
  });
});

// 数据库连接
async function connectDB() {
  const mongoUrl = config.mongodb.uri;
  console.log(`[MongoDB] 连接中... ${mongoUrl}`);
  
  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 5000
  });
  console.log('[MongoDB] 连接成功');
}

// Redis连接
async function connectRedis() {
  const redisClient = createClient({
    url: config.redis.uri,
    socket: {
      connectTimeout: 5000
    }
  });
  
  redisClient.on('error', (err) => {
    console.error('[Redis] 连接错误:', err.message);
  });
  
  redisClient.on('connect', () => {
    console.log('[Redis] 连接成功');
  });
  
  await redisClient.connect();
  return redisClient;
}

// 启动服务器
async function start() {
  try {
    console.log('========================================');
    console.log(`  ${config.gameName} v${config.gameVersion}`);
    console.log('========================================');
    
    // 连接数据库
    await connectDB();
    
    // 连接Redis
    const redisClient = await connectRedis();
    app.locals.redis = redisClient;
    
    // 初始化游戏系统
    await initGameSystems();
    console.log('[Game] 游戏系统初始化完成');
    
    // 初始化WebSocket
    socketHandler(io);
    console.log('[Socket] WebSocket初始化完成');
    
    // 启动HTTP服务
    server.listen(config.port, config.host, () => {
      console.log(`[Server] 服务已启动: http://${config.host}:${config.port}`);
      console.log(`[Server] API地址: http://${config.host}:${config.port}/api`);
      console.log(`[Server] 健康检查: http://${config.host}:${config.port}/health`);
    });
    
  } catch (error) {
    console.error('[Server] 启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Server] 收到SIGTERM信号，正在关闭...');
  await mongoose.connection.close();
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  server.close(() => {
    console.log('[Server] 已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[Server] 收到SIGINT信号，正在关闭...');
  await mongoose.connection.close();
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  server.close(() => {
    console.log('[Server] 已关闭');
    process.exit(0);
  });
});

start();
