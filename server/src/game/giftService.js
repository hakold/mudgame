const path = require('path');
const Inventory = require('../models/Inventory');
const User = require('../models/User');

// Load gift pool config
let giftPools = [];
function loadGiftPools() {
  try {
    giftPools = require(path.join(__dirname, '../../config/json/giftPools.json'));
  } catch (e) {
    giftPools = [];
  }
}
loadGiftPools();
function getGiftPools() { return giftPools; }
function getGiftPool(poolId) { return giftPools.find(p => p.id === poolId); }
function reloadGiftPools() { loadGiftPools(); return giftPools; }

/**
 * Open a gift item: draw from its pool and grant the resulting item.
 * @param {string} userId
 * @param {object} giftItem - the inventory document
 * @param {object} giftConfig - the item config (from items.json)
 * @returns {object} { success, reward, message }
 */
async function openGift(userId, giftItem, giftConfig) {
  const poolId = giftConfig.giftPoolId;
  if (!poolId) {
    return { error: '此礼包没有配置奖池' };
  }

  const pool = getGiftPool(poolId);
  if (!pool) {
    return { error: `奖池「${poolId}」不存在` };
  }

  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };

  // Normalize draw probabilities
  const totalProb = pool.draws.reduce((sum, d) => sum + (d.probability || 0), 0);
  if (totalProb <= 0) {
    return { error: '奖池配置错误：概率总和为0' };
  }

  // Weighted random draw
  const roll = Math.random() * totalProb;
  let cumulative = 0;
  let draw = pool.draws[pool.draws.length - 1]; // fallback
  for (const d of pool.draws) {
    cumulative += (d.probability || 0);
    if (roll < cumulative) {
      draw = d;
      break;
    }
  }

  // Determine quantity
  const minQ = draw.minQuantity || 1;
  const maxQ = draw.maxQuantity || 1;
  const quantity = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));

  // Consume the gift item
  giftItem.quantity -= 1;
  if (giftItem.quantity <= 0) {
    await Inventory.deleteOne({ _id: giftItem._id });
  } else {
    await giftItem.save();
  }

  // Grant the reward item
  // Check if user already has the item, if so stack it; otherwise create new
  const existing = await Inventory.findOne({ userId, itemId: draw.itemId, isEquipped: false });
  if (existing) {
    existing.quantity += quantity;
    await existing.save();
  } else {
    await Inventory.create({ userId, itemId: draw.itemId, quantity });
  }

  return {
    success: true,
    reward: {
      itemId: draw.itemId,
      itemName: draw.name,
      quantity
    },
    message: `🎁 打开「${giftConfig.name}」，获得了 ${draw.name}×${quantity}！`
  };
}

/**
 * Use an exp-type consumable: grant exp to user.
 * @param {string} userId
 * @param {object} itemDoc - the inventory document
 * @param {object} itemConfig - the item config (from items.json)
 * @param {number} expValue
 * @returns {object} { success, expGained, leveledUp }
 */
async function useExpItem(userId, itemDoc, itemConfig, expValue) {
  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };

  // Consume the item
  itemDoc.quantity -= 1;
  if (itemDoc.quantity <= 0) {
    await Inventory.deleteOne({ _id: itemDoc._id });
  } else {
    await itemDoc.save();
  }

  // Grant exp
  user.exp += expValue;
  const messages = [];

  // Check level up
  let leveledUp = false;
  while (user.canLevelUp() && user.level < 100) {
    user.levelUp();
    leveledUp = true;
  }

  await user.save();

  return {
    success: true,
    expGained: expValue,
    currentExp: user.exp,
    level: user.level,
    leveledUp,
    message: leveledUp
      ? `📖 使用「${itemConfig.name}」获得 ${expValue} 经验，升级到 Lv${user.level}！`
      : `📖 使用「${itemConfig.name}」获得 ${expValue} 经验。`
  };
}

/**
 * Use a gold-type consumable: grant gold to user.
 */
async function useGoldItem(userId, itemDoc, itemConfig, goldValue) {
  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };

  itemDoc.quantity -= 1;
  if (itemDoc.quantity <= 0) {
    await Inventory.deleteOne({ _id: itemDoc._id });
  } else {
    await itemDoc.save();
  }

  user.gold += goldValue;
  user.stats = user.stats || {};
  user.stats.goldEarned = (user.stats.goldEarned || 0) + goldValue;
  await user.save();

  return {
    success: true,
    goldGained: goldValue,
    currentGold: user.gold,
    message: `💰 使用「${itemConfig.name}」获得 ${goldValue} 金币。`
  };
}

module.exports = {
  openGift,
  useExpItem,
  useGoldItem,
  getGiftPools,
  getGiftPool,
  reloadGiftPools
};
