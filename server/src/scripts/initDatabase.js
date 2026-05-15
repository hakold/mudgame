require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User } = require('../models');

async function initDatabase() {
  console.log('[Init] 开始初始化数据库...');
  
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DATABASE}`);
    console.log('[Init] 数据库连接成功');
    
    // 创建管理员账号
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = new User({
        username: 'admin',
        password: 'admin123',
        email: 'admin@wuxia.game',
        characterName: '系统管理员',
        gender: 'male',
        role: 'admin',
        level: 100,
        gold: 1000000,
        hp: { current: 10000, max: 10000 },
        mp: { current: 5000, max: 5000 },
        attributes: {
          strength: 100,
          dexterity: 100,
          constitution: 100,
          intelligence: 100,
          charisma: 100
        }
      });
      await admin.save();
      console.log('[Init] 管理员账号创建成功');
      console.log('[Init] 用户名: admin, 密码: admin123');
    } else {
      console.log('[Init] 管理员账号已存在');
    }
    
    // 创建GM账号
    const gmExists = await User.findOne({ username: 'gamemaster' });
    if (!gmExists) {
      const gm = new User({
        username: 'gamemaster',
        password: 'gm123456',
        email: 'gm@wuxia.game',
        characterName: '游戏管理员',
        gender: 'male',
        role: 'gm',
        level: 50,
        gold: 100000,
        hp: { current: 5000, max: 5000 },
        mp: { current: 2500, max: 2500 },
        attributes: {
          strength: 50,
          dexterity: 50,
          constitution: 50,
          intelligence: 50,
          charisma: 50
        }
      });
      await gm.save();
      console.log('[Init] GM账号创建成功');
      console.log('[Init] 用户名: gamemaster, 密码: gm123456');
    } else {
      console.log('[Init] GM账号已存在');
    }
    
    console.log('[Init] 数据库初始化完成');
    process.exit(0);
  } catch (error) {
    console.error('[Init] 初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
