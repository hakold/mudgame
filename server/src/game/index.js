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
  factions: {}
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
  
  console.log('[Game] 游戏配置加载完成');

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

// 获取房间内的NPC
function getNpcsInRoom(roomId) {
  return Object.values(gameConfig.npcs).filter(npc => npc.roomId === roomId);
}

// 获取房间内的怪物
function getMonstersInRoom(roomId) {
  return Object.values(gameConfig.monsters).filter(monster => monster.roomId === roomId);
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

// 获取可学习的技能（根据门派）
function getLearnableSkills(factionId, level = 1) {
  return Object.values(gameConfig.skills).filter(skill => {
    const requiredFaction = skill.factionRequired || skill.faction;

    if (requiredFaction === 'monster') return false;
    if (requiredFaction && requiredFaction !== 'general' && requiredFaction !== factionId) {
      return false;
    }

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
  getNpcsInRoom,
  getMonstersInRoom,
  getRoomExits,
  getItem,
  getSkill,
  getQuest,
  getFaction,
  getAllFactions,
  getAllSkills,
  getLearnableSkills,
  items: () => Object.values(gameConfig.items),
  gameConfig
};
