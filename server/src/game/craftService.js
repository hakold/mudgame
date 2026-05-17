const fs = require('fs');
const path = require('path');
const Inventory = require('../models/Inventory');
const { getItem } = require('./index');

// 加载生活技能配置
const gatheringNodes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/gatheringNodes.json'), 'utf-8'));
const alchemyRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/alchemyRecipes.json'), 'utf-8'));
const cookingRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/json/cookingRecipes.json'), 'utf-8'));

// 采集点冷却追踪 { nodeId: nextAvailableTimestamp }
const gatheringCooldowns = new Map();

function getGatheringNodes(roomId) {
  return gatheringNodes.filter(n => n.roomId === roomId);
}

function getAlchemyRecipes(level) {
  return alchemyRecipes.filter(r => r.level <= level);
}

function getCookingRecipes(level) {
  return cookingRecipes.filter(r => r.level <= level);
}

function getAlchemyRecipe(recipeId) {
  return alchemyRecipes.find(r => r.id === recipeId) || null;
}

function getCookingRecipe(recipeId) {
  return cookingRecipes.find(r => r.id === recipeId) || null;
}

// 检查采集点是否可用
function isNodeAvailable(nodeId) {
  const cooldown = gatheringCooldowns.get(nodeId);
  return !cooldown || cooldown <= Date.now();
}

// 获取剩余冷却秒数
function getNodeCooldown(nodeId) {
  const cooldown = gatheringCooldowns.get(nodeId);
  if (!cooldown || cooldown <= Date.now()) return 0;
  return Math.ceil((cooldown - Date.now()) / 1000);
}

// 执行采集
async function gather(userId, nodeId) {
  const node = gatheringNodes.find(n => n.id === nodeId);
  if (!node) return { error: '采集点不存在' };
  if (!isNodeAvailable(nodeId)) {
    const remaining = getNodeCooldown(nodeId);
    return { error: `采集点尚未刷新，还需等待 ${remaining} 秒` };
  }

  // 随机数量
  const [min, max] = node.quantity;
  const quantity = Math.floor(Math.random() * (max - min + 1)) + min;

  // 设置冷却
  gatheringCooldowns.set(nodeId, Date.now() + node.respawnSeconds * 1000);

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
    nodeId,
    nodeName: node.name,
    itemId: node.itemId,
    itemName: itemConfig?.name || node.itemId,
    quantity,
    cooldownSeconds: node.respawnSeconds
  };
}

// 执行炼药
async function performAlchemy(userId, recipeId, userGold) {
  const recipe = getAlchemyRecipe(recipeId);
  if (!recipe) return { error: '炼药配方不存在' };

  if (userGold < recipe.goldCost) {
    return { error: `金币不足，需要 ${recipe.goldCost} 金币` };
  }

  // 检查材料
  for (const mat of recipe.materials) {
    const inv = await Inventory.findOne({ userId, itemId: mat.itemId });
    if (!inv || inv.quantity < mat.quantity) {
      const itemConfig = getItem(mat.itemId);
      return { error: `材料不足: ${itemConfig?.name || mat.itemId} 需要 ${mat.quantity}` };
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
    return {
      success: true,
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
      recipeId,
      recipeName: recipe.name,
      message: '炼制失败，材料已消耗',
      goldCost: recipe.goldCost
    };
  }
}

// 执行烹饪
async function performCooking(userId, recipeId, userGold) {
  const recipe = getCookingRecipe(recipeId);
  if (!recipe) return { error: '烹饪配方不存在' };

  if (userGold < recipe.goldCost) {
    return { error: `金币不足，需要 ${recipe.goldCost} 金币` };
  }

  // 检查材料
  for (const mat of recipe.materials) {
    const inv = await Inventory.findOne({ userId, itemId: mat.itemId });
    if (!inv || inv.quantity < mat.quantity) {
      const itemConfig = getItem(mat.itemId);
      return { error: `材料不足: ${itemConfig?.name || mat.itemId} 需要 ${mat.quantity}` };
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
    return {
      success: true,
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
      recipeId,
      recipeName: recipe.name,
      message: '烹饪失败，食材已消耗',
      goldCost: recipe.goldCost
    };
  }
}

module.exports = {
  getGatheringNodes,
  getAlchemyRecipes,
  getCookingRecipes,
  getAlchemyRecipe,
  getCookingRecipe,
  performAlchemy,
  performCooking,
  gather,
  gatheringCooldowns,
  gatheringNodes,
  alchemyRecipes,
  cookingRecipes
};
