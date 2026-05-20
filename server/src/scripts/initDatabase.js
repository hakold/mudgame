require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config');
const models = require('../models');

const ALL_MODELS = [
  { name: 'User', model: models.User },
  { name: 'CharacterSkill', model: models.CharacterSkill },
  { name: 'Inventory', model: models.Inventory },
  { name: 'Quest', model: models.Quest },
  { name: 'ChatMessage', model: models.ChatMessage },
  { name: 'BattleLog', model: models.BattleLog },
  { name: 'Announcement', model: models.Announcement },
  { name: 'Achievement', model: models.Achievement },
  { name: 'Daily', model: models.Daily },
  { name: 'Auction', model: models.Auction },
  { name: 'Gang', model: models.Gang },
  { name: 'ActionLog', model: models.ActionLog },
];

function askConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      '\n⚠️  警告: 此操作将清空数据库所有数据，然后重新初始化！\n' +
      '   包括: 用户、技能、背包、任务、聊天、战斗日志、公告、成就、\n' +
      '         每日任务、拍卖行、帮派、操作日志等所有集合。\n\n' +
      '   输入 YES 确认执行，其他任意键取消: ',
      (answer) => {
        rl.close();
        resolve(answer.trim() === 'YES');
      }
    );
  });
}

async function clearDatabase() {
  console.log('[Init] 开始清空数据库...');
  let totalDeleted = 0;
  for (const { name, model } of ALL_MODELS) {
    const result = await model.deleteMany({});
    if (result.deletedCount > 0) {
      console.log(`  - ${name}: 删除 ${result.deletedCount} 条记录`);
      totalDeleted += result.deletedCount;
    }
  }
  console.log(`[Init] 数据库清空完成，共删除 ${totalDeleted} 条记录\n`);
}

async function createSeedData() {
  console.log('[Init] 开始创建初始数据...');

  // 创建管理员账号
  const admin = new models.User({
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
  console.log('[Init] 管理员账号创建成功 (admin / admin123)');

  // 创建GM账号
  const gm = new models.User({
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
  console.log('[Init] GM账号创建成功 (gamemaster / gm123456)');
}

async function initDatabase() {
  console.log('[Init] ========== 数据库初始化脚本 ==========');

  try {
    const mongoUri = config.mongodb.uri;
    console.log(`[Init] 连接数据库: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('[Init] 数据库连接成功\n');

    // 确认后先清后加
    const confirmed = await askConfirmation();
    if (!confirmed) {
      console.log('[Init] 操作已取消。');
      await mongoose.disconnect();
      process.exit(0);
    }

    await clearDatabase();
    await createSeedData();

    console.log('\n[Init] ========== 数据库初始化完成 ==========');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Init] 初始化失败:', error);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

initDatabase();
