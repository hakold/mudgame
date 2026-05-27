const config = require('../config');
const fs = require('fs');
const path = require('path');

// 游戏配置缓存
let gameConfig = {
  maps: {},
  rooms: {},
  npcs: {},
  monsters: {},
  items: {},
  skills: {},
  quests: {},
  factions: {},
  factionQuests: {},
  achievements: {},
  forgeRecipes: {},
  weatherConfig: {}
};

// 加载JSON配置
function loadJsonConfig(filename) {
  const filePath = path.join(__dirname, '../../../config/json', `${filename}.json`);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }
  return [];
}

// 初始化游戏系统
async function initGameSystems() {
  console.log('[Game] 加载游戏配置...');
  
  // 加载地图配置
  const maps = loadJsonConfig('maps');
  maps.forEach(map => {
    gameConfig.maps[map.id] = map;
  });
  console.log(`[Game] 加载地图: ${Object.keys(gameConfig.maps).length} 个`);
  
  // 加载房间配置
  const rooms = loadJsonConfig('rooms');
  rooms.forEach(room => {
    gameConfig.rooms[room.id] = room;
  });
  console.log(`[Game] 加载房间: ${Object.keys(gameConfig.rooms).length} 个`);
  
  // 加载NPC配置
  const npcs = loadJsonConfig('npcs');
  npcs.forEach(npc => {
    gameConfig.npcs[npc.id] = npc;
  });
  console.log(`[Game] 加载NPC: ${Object.keys(gameConfig.npcs).length} 个`);
  
  // 加载怪物配置
  const monsters = loadJsonConfig('monsters');
  monsters.forEach(monster => {
    gameConfig.monsters[monster.id] = monster;
  });
  console.log(`[Game] 加载怪物: ${Object.keys(gameConfig.monsters).length} 个`);
  
  // 加载物品配置
  const items = loadJsonConfig('items');
  items.forEach(item => {
    gameConfig.items[item.id] = item;
  });
  console.log(`[Game] 加载物品: ${Object.keys(gameConfig.items).length} 个`);
  
  // 加载技能配置
  const skills = loadJsonConfig('skills');
  skills.forEach(skill => {
    gameConfig.skills[skill.id] = skill;
  });
  console.log(`[Game] 加载技能: ${Object.keys(gameConfig.skills).length} 个`);
  
  // 加载任务配置
  const quests = loadJsonConfig('quests');
  quests.forEach(quest => {
    gameConfig.quests[quest.id] = quest;
  });
  console.log(`[Game] 加载任务: ${Object.keys(gameConfig.quests).length} 个`);
  
  // 加载门派配置
  const factions = loadJsonConfig('factions');
  factions.forEach(faction => {
    gameConfig.factions[faction.id] = faction;
  });
  console.log(`[Game] 加载门派: ${Object.keys(gameConfig.factions).length} 个`);
  
  // 加载门派任务配置
  const factionQuests = loadJsonConfig('factionQuests');
  factionQuests.forEach(quest => {
    gameConfig.factionQuests[quest.id] = quest;
  });
  console.log(`[Game] 加载门派任务: ${Object.keys(gameConfig.factionQuests).length} 个`);
  
  // 加载成就配置
  const achievements = loadJsonConfig('achievements');
  achievements.forEach(ach => {
    gameConfig.achievements[ach.id] = ach;
  });
  console.log(`[Game] 加载成就: ${Object.keys(gameConfig.achievements).length} 个`);
  
  // 加载锻造配方配置
  const forgeRecipes = loadJsonConfig('forgeRecipes');
  forgeRecipes.forEach(recipe => {
    gameConfig.forgeRecipes[recipe.id] = recipe;
  });
  console.log(`[Game] 加载锻造配方: ${Object.keys(gameConfig.forgeRecipes).length} 个`);
  
  // 加载天气配置
  gameConfig.weatherConfig = loadJsonConfig('weatherConfig');
  console.log(`[Game] 加载天气配置`);
  
  console.log('[Game] 游戏配置加载完成');

  // 启动配置热重载
  startConfigWatcher();

  // 给任务目标注入显示名称
  for (const quest of Object.values(gameConfig.quests)) {
    for (const obj of quest.objectives) {
      const targetId = obj.monsterId || obj.npcId || obj.roomId || obj.itemId;
      if (targetId && targetId !== 'any') {
        obj.targetName = gameConfig.monsters[targetId]?.name
          || gameConfig.npcs[targetId]?.name
          || gameConfig.rooms[targetId]?.name
          || gameConfig.items[targetId]?.name
          || targetId;
      }
    }
  }
}

// 获取地图信息
function getMap(mapId) {
  return gameConfig.maps[mapId] || null;
}

// 获取房间信息
function getRoom(roomId) {
  return gameConfig.rooms[roomId] || null;
}

// 获取NPC配置
function getNpc(npcId) {
  return gameConfig.npcs[npcId] || null;
}

// 获取房间内的NPC
function getNpcsInRoom(roomId) {
  return Object.values(gameConfig.npcs).filter(npc => npc.roomIds?.includes(roomId));
}

// 获取房间内的怪物（聚合 room.monsters + map.monsters + 怪物自身的 roomId）
function getMonstersInRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) return [];
  
  const result = [];
  const seen = new Set();
  
  // 1. 旧格式：怪物自身的 roomId
  const directMonsters = Object.values(gameConfig.monsters).filter(m => m.roomId === roomId);
  for (const m of directMonsters) {
    if (!seen.has(m.id)) {
      result.push({ ...m, _spawnWeight: m.spawnWeight || 1 });
      seen.add(m.id);
    }
  }
  
  // 2. 房间配置的 monsters 数组
  for (const entry of (room.monsters || [])) {
    const monster = gameConfig.monsters[entry.monsterId];
    if (monster && !seen.has(monster.id)) {
      result.push({ ...monster, _spawnWeight: entry.spawnWeight || 1 });
      seen.add(monster.id);
    }
  }
  
  // 3. 地图配置的 monsters 数组（该房间所属地图）
  const map = getMap(room.mapId);
  if (map) {
    for (const entry of (map.monsters || [])) {
      const monster = gameConfig.monsters[entry.monsterId];
      if (monster && !seen.has(monster.id)) {
        result.push({ ...monster, _spawnWeight: entry.spawnWeight || 1 });
        seen.add(monster.id);
      }
    }
  }
  
  return result;
}

// 获取房间出口
function getRoomExits(roomId) {
  const room = getRoom(roomId);
  if (!room || !room.exits) return [];
  
  return room.exits.map(exit => ({
    direction: exit.direction,
    roomId: exit.roomId,
    roomName: getRoom(exit.roomId)?.name || '未知区域'
  }));
}

// 获取物品配置
function getItem(itemId) {
  return gameConfig.items[itemId] || null;
}

// 通过名称查找物品（支持中文/英文名称）
function getItemByName(name) {
  return Object.values(gameConfig.items).find(item => item.name === name || item.id === name) || null;
}

// 获取技能配置
function getSkill(skillId) {
  return gameConfig.skills[skillId] || null;
}

// 获取任务配置
function getQuest(questId) {
  return gameConfig.quests[questId] || null;
}

// 获取门派配置
function getFaction(factionId) {
  return gameConfig.factions[factionId] || null;
}

// 获取所有门派
function getAllFactions() {
  return Object.values(gameConfig.factions);
}

// 获取所有技能
function getAllSkills() {
  return Object.values(gameConfig.skills);
}

// 获取可学习的技能（根据门派和门派等级）
function getLearnableSkills(factionId, level = 1, factionRank = 'disciple') {
  const rankOrder = ['disciple', 'deacon', 'elder', 'leader'];
  const rankIndex = rankOrder.indexOf(factionRank);

  return Object.values(gameConfig.skills).filter(skill => {
    const requiredFaction = skill.factionRequired || skill.faction;

    // 怪物/NPC专属技能，玩家不可学
    if (requiredFaction === 'monster') return false;
    if (requiredFaction === 'bandit' || requiredFaction === 'evil' || requiredFaction === 'guard') return false;

    // 门派专属技能：检查门派归属
    if (requiredFaction && requiredFaction !== 'general' && requiredFaction !== factionId) {
      return false;
    }

    // 门派等级限制（仅对门派专属技能生效）
    if (requiredFaction && requiredFaction !== 'general' && skill.rankRequired) {
      const skillRankIndex = rankOrder.indexOf(skill.rankRequired);
      if (rankIndex < skillRankIndex) return false;
    }

    // 等级限制（所有技能都需要检查）
    if (skill.requireLevel && skill.requireLevel > level) {
      return false;
    }

    return true;
  });
}

module.exports = {
  initGameSystems,
  getMap,
  getRoom,
  getNpc,
  getNpcsInRoom,
  getMonstersInRoom,
  getRoomExits,
  getItem,
  getItemByName,
  getSkill,
  getQuest,
  getFaction,
  getAllFactions,
  getAllSkills,
  getLearnableSkills,
  getFactionQuest: (questId) => gameConfig.factionQuests[questId] || null,
  getFactionQuestsByFaction: (factionId) => Object.values(gameConfig.factionQuests).filter(q => q.factionId === factionId),
  getAchievement: (achId) => gameConfig.achievements[achId] || null,
  getAllAchievements: () => Object.values(gameConfig.achievements),
  getForgeRecipe: (recipeId) => gameConfig.forgeRecipes[recipeId] || null,
  getAllForgeRecipes: () => Object.values(gameConfig.forgeRecipes),
  items: () => Object.values(gameConfig.items),
  gameConfig,
  // 从内存获取配置数组（零磁盘IO）
  getConfigArray(key) { return Object.values(gameConfig[key] || {}) },
  // 从磁盘重载单个配置段到内存
  reloadConfigSection(key) {
    const configFileMap = {
      maps:'maps', rooms:'rooms', npcs:'npcs', monsters:'monsters',
      items:'items', skills:'skills', quests:'quests', factions:'factions',
      factionQuests:'factionQuests', achievements:'achievements',
      forgeRecipes:'forgeRecipes', weatherConfig:'weatherConfig'
    }
    const filename = configFileMap[key]
    if (!filename) return
    const filePath = path.join(__dirname, '../../../config/json', `${filename}.json`)
    if (!fs.existsSync(filePath)) return
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (Array.isArray(data)) {
      gameConfig[key] = {}
      for (const item of data) gameConfig[key][item.id] = item
    } else {
      gameConfig[key] = data
    }
    configVersion++
  }
};

// 配置热重载
const configFileMap = {
  maps: 'maps', rooms: 'rooms', npcs: 'npcs', monsters: 'monsters',
  items: 'items', skills: 'skills', quests: 'quests', factions: 'factions',
  factionQuests: 'factionQuests', achievements: 'achievements',
  forgeRecipes: 'forgeRecipes', weatherConfig: 'weatherConfig'
};

let configVersion = 0;
function startConfigWatcher() {
  const configDir = path.join(__dirname, '../../../config/json');
  try {
    fs.watch(configDir, { recursive: false }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      const baseName = filename.replace('.json', '');
      const configKey = configFileMap[baseName];
      if (!configKey) return;

      // 防抖：延迟200ms，避免编辑器多次保存
      clearTimeout(startConfigWatcher._timeout);
      startConfigWatcher._timeout = setTimeout(() => {
        try {
          const filePath = path.join(configDir, filename);
          if (!fs.existsSync(filePath)) return;

          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);

          if (Array.isArray(data)) {
            gameConfig[configKey] = {};
            for (const item of data) {
              gameConfig[configKey][item.id] = item;
            }
          } else {
            gameConfig[configKey] = data;
          }

          configVersion++;
          console.log(`[Game] 配置热重载: ${filename} (v${configVersion})`);
        } catch (err) {
          console.error(`[Game] 配置热重载失败 ${filename}:`, err.message);
        }
      }, 200);
    });
    console.log('[Game] 配置热重载监控已启动');
  } catch (err) {
    console.warn('[Game] 配置热重载监控启动失败:', err.message);
  }
}

function getConfigVersion() {
  return configVersion;
}

module.exports.startConfigWatcher = startConfigWatcher;
module.exports.getConfigVersion = getConfigVersion;
