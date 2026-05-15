// 修复用户location字段的脚本
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function fixUserLocations() {
  try {
    const mongoUri = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DATABASE}`;
    console.log('连接MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('MongoDB连接成功');
    
    // 更新所有location.roomId为'square'的用户
    const result = await User.updateMany(
      { 'location.roomId': 'square' },
      { 
        $set: { 
          'location.roomId': 'village_center',
          'location.mapId': 'village'
        }
      }
    );
    
    console.log(`更新了 ${result.modifiedCount} 个用户的location`);
    
    // 验证
    const users = await User.find({}, 'characterName location');
    users.forEach(u => {
      console.log(`${u.characterName}: ${u.location.mapId}/${u.location.roomId}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

fixUserLocations();
