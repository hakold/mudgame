const fs = require('fs');
const path = require('path');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const { getItem } = require('./index');

// 三系采集配置
const herbNodes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/herbNodes.json'), 'utf-8'));
const miningNodes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/miningNodes.json'), 'utf-8'));
const fishingNodes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/fishingNodes.json'), 'utf-8'));

// 三系制造配方
const alchemyRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/alchemyRecipes.json'), 'utf-8'));
const cookingRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/cookingRecipes.json'), 'utf-8'));
const forgeRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/forgeRecipes.json'), 'utf-8'));

// 三系采集冷却追踪
const herbCooldowns = new Map();
const miningCooldowns = new Map();
const fishingCooldowns = new Map();

// ==================== 工具函数 ====================

function getCooldownMap(skillType) {
  const map = { herb: herbCooldowns, mining: miningCooldowns, fishing: fishingCooldowns };
  return map[skillType] || herbCooldowns;
}

function getNodesByType(skillType) {
  const map = { herb: herbNodes, mining: miningNodes, fishing: fishingNodes };
  return map[skillType] || herbNodes;
}

function isNodeAvailable(skillType, nodeId) {
  const cd = getCooldownMap(skillType);
  const cooldown = cd.get(nodeId);
  return !cooldown || cooldown <= Date.now();
}

function getNodeCooldown(skillType, nodeId) {
  const cd = getCooldownMap(skillType);
  const cooldown = cd.get(nodeId);
  if (!cooldown || cooldown <= Date.now()) return 0;
  return Math.ceil((cooldown - Date.now()) / 1000);
}

// ==================== 采集 ====================

// 获取房间内所有采集点（三系合并）
function getAllGatheringNodes(roomId) {
  const allNodes = [];
  for (const n of herbNodes) {
    if (n.roomId === roomId) allNodes.push({ ...n, skillType: 'herb', icon: '🌿' });
  }
  for (const n of miningNodes) {
    if (n.roomId === roomId) allNodes.push({ ...n, skillType: 'mining', icon: '⛏️' });
  }
  for (const n of fishingNodes) {
    if (n.roomId === roomId) allNodes.push({ ...n, skillType: 'fishing', icon: '🎣' });
  }
  return allNodes;
}

// 获取特定类型采集点
function getNodesBySkillType(skillType) {
  return getNodesByType(skillType).map(n => ({
    ...n,
    skillType,
    available: isNodeAvailable(skillType, n.id),
    cooldownRemaining: getNodeCooldown(skillType, n.id)
  }));
}

// 执行采集
async function gather(userId, skillType, nodeId) {
  const nodes = getNodesByType(skillType);
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return { error: '采集点不存在' };
  if (!isNodeAvailable(skillType, nodeId)) {
    const remaining = getNodeCooldown(skillType, nodeId);
    return { error: `采集点尚未刷新，还需等待 ${remaining} 秒` };
  }

  // 随机数量
  const [min, max] = node.quantity;
  const quantity = Math.floor(Math.random() * (max - min + 1)) + min;

  // 设置冷却
  getCooldownMap(skillType).set(nodeId, Date.now() + node.respawnSeconds * 1000);

  // 添加到背包
  const itemConfig = getItem(node.itemId);
  let inv = await Inventory.findOne({ userId, itemId: node.itemId });
  if (inv) {
    inv.quantity += quantity;
    await inv.save();
  } else {
    await Inventory.create({ userId, itemId: node.itemId, quantity });
  }

  return {
    success: true,
    skillType,
    nodeId,
    nodeName: node.name,
    itemId: node.itemId,
    itemName: itemConfig?.name || node.itemId,
    quantity,
    cooldownSeconds: node.respawnSeconds
  };
}

// ==================== 制造 ====================

function getRecipesBySkill(skillType, level) {
  const map = { alchemy: alchemyRecipes, cooking: cookingRecipes, forging: forgeRecipes };
  const recipes = map[skillType] || [];
  return recipes.filter(r => r.level <= level);
}

function getRecipe(skillType, recipeId) {
  const map = { alchemy: alchemyRecipes, cooking: cookingRecipes, forging: forgeRecipes };
  const recipes = map[skillType] || [];
  return recipes.find(r => r.id === recipeId) || null;
}

// 执行制造（通用）
async function performCraft(userId, skillType, recipeId, userGold) {
  const recipe = getRecipe(skillType, recipeId);
  if (!recipe) return { error: '配方不存在' };

  if (userGold < recipe.goldCost) {
    return { error: `金币不足，需要 ${recipe.goldCost} 金币` };
  }

  // 检查材料
  for (const mat of recipe.materials) {
    const inv = await Inventory.findOne({ userId, itemId: mat.itemId });
    if (!inv || inv.quantity < mat.quantity) {
      const itemConfig = getItem(mat.itemId);
      return { error: `材料不足: ${itemConfig?.name || mat.itemId} 需要 ${mat.quantity}个` };
    }
  }

  // 扣除材料
  for (const mat of recipe.materials) {
    const inv = await Inventory.findOne({ userId, itemId: mat.itemId });
    if (inv.quantity <= mat.quantity) {
      await Inventory.deleteOne({ _id: inv._id });
    } else {
      inv.quantity -= mat.quantity;
      await inv.save();
    }
  }

  // 判断成功
  const success = Math.random() < recipe.successRate;

  if (success) {
    const resultItem = getItem(recipe.result.itemId);
    let inv = await Inventory.findOne({ userId, itemId: recipe.result.itemId });
    if (inv) {
      inv.quantity += recipe.result.quantity;
      await inv.save();
    } else {
      await Inventory.create({ userId, itemId: recipe.result.itemId, quantity: recipe.result.quantity });
    }

    // 更新生活技能经验
    await addLifeSkillExp(userId, skillType, recipe.exp);

    return {
      success: true,
      skillType,
      recipeId,
      recipeName: recipe.name,
      resultItemId: recipe.result.itemId,
      resultItemName: resultItem?.name || recipe.result.itemId,
      quantity: recipe.result.quantity,
      expGained: recipe.exp,
      goldCost: recipe.goldCost
    };
  } else {
    return {
      success: false,
      skillType,
      recipeId,
      recipeName: recipe.name,
      message: skillType === 'alchemy' ? '炼制失败，材料已消耗' : skillType === 'cooking' ? '烹饪失败，食材已消耗' : '锻造失败，材料已消耗',
      goldCost: recipe.goldCost
    };
  }
}

// ==================== 生活技能熟练度 ====================

async function addLifeSkillExp(userId, skillType, exp) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    user.lifeSkills = user.lifeSkills || {};
    user.lifeSkills[skillType] = user.lifeSkills[skillType] || { level: 1, exp: 0 };
    
    const skill = user.lifeSkills[skillType];
    skill.exp += exp;
    
    // 经验升级：level*100 经验升一级
    const expNeeded = skill.level * 100;
    while (skill.exp >= expNeeded) {
      skill.exp -= expNeeded;
      skill.level += 1;
    }
    
    await user.save();
  } catch (e) {
    // 非关键路径，静默失败
  }
}

async function getLifeSkills(userId) {
  try {
    const user = await User.findById(userId, 'lifeSkills').lean();
    return user?.lifeSkills || {
      herb: { level: 1, exp: 0 },
      mining: { level: 1, exp: 0 },
      fishing: { level: 1, exp: 0 },
      alchemy: { level: 1, exp: 0 },
      cooking: { level: 1, exp: 0 },
      forging: { level: 1, exp: 0 }
    };
  } catch (e) {
    return {};
  }
}

// ==================== 导出 ====================

module.exports = {
  // 采集
  getAllGatheringNodes,
  getNodesBySkillType,
  gather,
  // 配方查询
  getRecipesBySkill,
  getRecipe,
  // 制造
  performCraft,
  // 生活技能
  addLifeSkillExp,
  getLifeSkills,
  // 配置引用
  herbNodes,
  miningNodes,
  fishingNodes,
  alchemyRecipes,
  cookingRecipes,
  forgeRecipes
};
