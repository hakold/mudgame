require('dotenv').config();

module.exports = {
  // 服务器配置
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // 游戏配置
  gameName: process.env.GAME_NAME || '侠客行',
  gameVersion: process.env.GAME_VERSION || '1.0.0',
  
  // MongoDB配置
  mongodb: {
    host: process.env.MONGODB_HOST || 'localhost',
    port: parseInt(process.env.MONGODB_PORT) || 27017,
    database: process.env.MONGODB_DATABASE || 'wuxia_mud',
    user: process.env.MONGODB_USER || '',
    password: process.env.MONGODB_PASSWORD || '',
    get uri() {
      const auth = this.user && this.password 
        ? `${this.user}:${this.password}@` 
        : '';
      return `mongodb://${auth}${this.host}:${this.port}/${this.database}`;
    }
  },
  
  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    get uri() {
      const auth = this.password 
        ? `:${this.password}@` 
        : '';
      return `redis://${auth}${this.host}:${this.port}`;
    }
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'wuxia_mud_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // CORS配置
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : true, // 允许所有来源（开发环境）
  
  // 游戏常量
  game: {
    // 初始属性
    initialAttributes: {
      strength: 10,      // 力量
      dexterity: 10,     // 敏捷
      constitution: 10,  // 体质
      intelligence: 10,  // 悟性
      charisma: 10       // 根骨
    },
    // 初始HP/MP
    initialHP: 100,
    initialMP: 50,
    // 初始金钱
    initialGold: 100,
    // 初始经验
    initialExp: 0,
    // 初始等级
    initialLevel: 1,
    // 最大等级
    maxLevel: 100,
    // 升级经验公式基数
    expBase: 100,
    // 升级经验公式指数
    expExponent: 1.5
  }
};
