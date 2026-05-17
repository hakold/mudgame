const Auction = require('../models/Auction');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { getItem } = require('./index');

// 手续费率
const LISTING_FEE_RATE = 0.05;

// 清理过期拍卖（每5分钟）
setInterval(async () => {
  try {
    const expired = await Auction.updateMany(
      { status: 'active', expiresAt: { $lte: new Date() } },
      { $set: { status: 'expired' } }
    );
    if (expired.modifiedCount > 0) {
      console.log(`[Auction] ${expired.modifiedCount} listings expired`);
    }
  } catch (err) {
    console.error('[Auction] Expiry cleanup error:', err.message);
  }
}, 300000);

// 挂单
async function createListing(userId, sellerName, itemId, quantity, unitPrice, durationHours = 24) {
  if (![24, 48, 72].includes(durationHours)) {
    return { error: '挂单时长仅支持 24/48/72 小时' };
  }
  if (quantity < 1 || unitPrice < 1) {
    return { error: '数量和单价必须大于0' };
  }

  const totalPrice = quantity * unitPrice;
  const listingFee = Math.max(1, Math.floor(totalPrice * LISTING_FEE_RATE));

  // 检查背包中是否有该物品
  const invItem = await Inventory.findOne({ userId, itemId, isEquipped: false });
  if (!invItem || invItem.quantity < quantity) {
    return { error: '背包中物品不足' };
  }

  // 检查金币是否够手续费
  const user = await User.findById(userId);
  if (user.gold < listingFee) {
    return { error: `金币不足，手续费需 ${listingFee} 金币` };
  }

  // 扣物品和手续费
  if (invItem.quantity <= quantity) {
    await Inventory.deleteOne({ _id: invItem._id });
  } else {
    invItem.quantity -= quantity;
    await invItem.save();
  }
  user.gold -= listingFee;
  await user.save();

  const itemConfig = getItem(itemId);
  const listing = await Auction.create({
    sellerId: userId,
    sellerName,
    itemId,
    itemName: itemConfig?.name || itemId,
    quantity,
    unitPrice,
    totalPrice,
    duration: durationHours,
    listingFee,
    expiresAt: new Date(Date.now() + durationHours * 3600000)
  });

  return {
    success: true,
    listing: {
      id: listing._id,
      sellerName: listing.sellerName,
      itemId: listing.itemId,
      itemName: listing.itemName,
      quantity: listing.quantity,
      unitPrice: listing.unitPrice,
      totalPrice: listing.totalPrice,
      duration: listing.duration,
      expiresAt: listing.expiresAt,
      createdAt: listing.createdAt
    },
    fee: listingFee,
    remainingGold: user.gold
  };
}

// 搜索拍卖
async function searchListings(query = {}, page = 1, limit = 20) {
  const filter = { status: 'active', expiresAt: { $gt: new Date() } };

  if (query.itemName) {
    filter.itemName = { $regex: query.itemName, $options: 'i' };
  }
  if (query.sellerName) {
    filter.sellerName = { $regex: query.sellerName, $options: 'i' };
  }
  if (query.itemId) {
    filter.itemId = query.itemId;
  }
  if (query.maxPrice) {
    filter.unitPrice = { $lte: parseInt(query.maxPrice) };
  }
  if (query.minPrice) {
    filter.unitPrice = { ...(filter.unitPrice || {}), $gte: parseInt(query.minPrice) };
  }

  const total = await Auction.countDocuments(filter);
  const listings = await Auction.find(filter)
    .sort({ unitPrice: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    listings: listings.map(l => ({
      id: l._id,
      sellerName: l.sellerName,
      itemId: l.itemId,
      itemName: l.itemName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.totalPrice,
      duration: l.duration,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

// 购买
async function buyListing(listingId, buyerId, buyerName) {
  const listing = await Auction.findOne({ _id: listingId, status: 'active' });
  if (!listing) return { error: '该拍卖不存在或已过期' };
  if (listing.sellerId.toString() === buyerId.toString()) {
    return { error: '不能购买自己的拍卖' };
  }
  if (listing.isExpired()) {
    listing.status = 'expired';
    await listing.save();
    return { error: '该拍卖已过期' };
  }

  const buyer = await User.findById(buyerId);
  if (buyer.gold < listing.totalPrice) {
    return { error: `金币不足，需要 ${listing.totalPrice} 金币` };
  }

  // 扣买方金币
  buyer.gold -= listing.totalPrice;
  await buyer.save();

  // 给卖方加金币（扣除5%交易税）
  const tax = Math.max(1, Math.floor(listing.totalPrice * 0.05));
  const sellerReceive = listing.totalPrice - tax;
  await User.findByIdAndUpdate(listing.sellerId, { $inc: { gold: sellerReceive } });

  // 物品给买方
  const itemConfig = getItem(listing.itemId);
  let buyerInv = await Inventory.findOne({ userId: buyerId, itemId: listing.itemId });
  if (buyerInv) {
    buyerInv.quantity += listing.quantity;
    await buyerInv.save();
  } else {
    await Inventory.create({
      userId: buyerId,
      itemId: listing.itemId,
      quantity: listing.quantity,
      durability: itemConfig?.durability ? { current: itemConfig.durability, max: itemConfig.durability } : undefined
    });
  }

  listing.status = 'sold';
  listing.buyerId = buyerId;
  listing.buyerName = buyerName;
  listing.soldAt = new Date();
  await listing.save();

  return {
    success: true,
    listing: {
      id: listing._id,
      itemName: listing.itemName,
      quantity: listing.quantity,
      totalPrice: listing.totalPrice,
      tax
    },
    sellerReceived: sellerReceive,
    remainingGold: buyer.gold
  };
}

// 取消挂单
async function cancelListing(listingId, userId) {
  const listing = await Auction.findOne({ _id: listingId, sellerId: userId, status: 'active' });
  if (!listing) return { error: '该拍卖不存在或无法取消' };

  listing.status = 'cancelled';
  await listing.save();

  // 退回物品（不退手续费）
  const itemConfig = getItem(listing.itemId);
  let inv = await Inventory.findOne({ userId, itemId: listing.itemId });
  if (inv) {
    inv.quantity += listing.quantity;
    await inv.save();
  } else {
    await Inventory.create({
      userId,
      itemId: listing.itemId,
      quantity: listing.quantity,
      durability: itemConfig?.durability ? { current: itemConfig.durability, max: itemConfig.durability } : undefined
    });
  }

  return { success: true, message: '拍卖已取消，物品已退回背包' };
}

// 获取玩家的挂单
async function getMyListings(userId) {
  const listings = await Auction.find({ sellerId: userId }).sort({ createdAt: -1 }).lean();
  return listings.map(l => ({
    id: l._id,
    sellerName: l.sellerName,
    itemId: l.itemId,
    itemName: l.itemName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    totalPrice: l.totalPrice,
    status: l.status,
    buyerName: l.buyerName,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
    soldAt: l.soldAt
  }));
}

module.exports = {
  createListing,
  searchListings,
  buyListing,
  cancelListing,
  getMyListings
};
