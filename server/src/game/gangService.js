const Gang = require('../models/Gang');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { getItem } = require('./index');

// 创建帮派
async function createGang(userId, name, description = '') {
  if (!name || name.length < 2 || name.length > 12) {
    return { error: '帮派名称需 2-12 个字符' };
  }

  const existing = await Gang.findOne({ name });
  if (existing) return { error: '此帮派名称已被使用' };

  // 检查玩家是否已有帮派
  const userGang = await Gang.findOne({ 'members.userId': userId });
  if (userGang) return { error: '你已加入帮派，需先退出当前帮派' };

  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };
  if (user.level < 5) return { error: '需要等级 5 才能创建帮派' };
  if (user.gold < 1000) return { error: '需要 1000 金币创建帮派' };

  user.gold -= 1000;
  await user.save();

  const gang = await Gang.create({
    name,
    description,
    members: [{ userId, name: user.characterName, role: 'leader' }]
  });

  return {
    success: true,
    gang: {
      id: gang._id,
      name: gang.name,
      description: gang.description,
      level: gang.level,
      memberCount: gang.members.length,
      leader: user.characterName
    }
  };
}

// 加入帮派
async function joinGang(userId, gangName) {
  const gang = await Gang.findOne({ name: gangName });
  if (!gang) return { error: '帮派不存在' };

  const user = await User.findById(userId);
  if (!user) return { error: '用户不存在' };

  const existingMember = gang.getMember(userId);
  if (existingMember) return { error: '你已在此帮派中' };

  const userGang = await Gang.findOne({ 'members.userId': userId });
  if (userGang) return { error: '你已加入其他帮派，需先退出' };

  gang.members.push({ userId, name: user.characterName, role: 'member' });
  await gang.save();

  return {
    success: true,
    gang: { id: gang._id, name: gang.name, level: gang.level, memberCount: gang.members.length }
  };
}

// 退出帮派
async function leaveGang(userId) {
  const gang = await Gang.findOne({ 'members.userId': userId });
  if (!gang) return { error: '你未加入任何帮派' };

  const member = gang.getMember(userId);
  if (member.role === 'leader') {
    // 转让给副帮主或最老成员
    const next = gang.members.find(m => m.userId.toString() !== userId.toString());
    if (next) {
      next.role = 'leader';
    } else {
      // 最后一个成员，解散帮派
      await Gang.deleteOne({ _id: gang._id });
      return { success: true, message: '帮派已解散' };
    }
  }

  gang.members = gang.members.filter(m => m.userId.toString() !== userId.toString());
  await gang.save();

  return { success: true, message: `已退出 ${gang.name}` };
}

// 获取帮派信息
async function getGangInfo(userId) {
  const gang = await Gang.findOne({ 'members.userId': userId });
  if (!gang) return null;

  const bonus = gang.getBonus();
  return {
    id: gang._id,
    name: gang.name,
    description: gang.description,
    level: gang.level,
    exp: gang.exp,
    nextLevelExp: Gang.levelRequirements.find(r => r.level === gang.level + 1)?.expNeeded || null,
    bonus,
    members: gang.members.map(m => ({
      name: m.name,
      role: m.role,
      contribution: m.contribution,
      joinedAt: m.joinedAt
    })),
    memberCount: gang.members.length,
    warehouse: gang.warehouse.map(w => ({
      itemId: w.itemId,
      itemName: w.itemName,
      quantity: w.quantity,
      depositedBy: w.depositedBy
    })),
    createdAt: gang.createdAt
  };
}

// 帮派捐献
async function donateToGang(userId, gold, itemId, itemQuantity) {
  const gang = await Gang.findOne({ 'members.userId': userId });
  if (!gang) return { error: '你未加入任何帮派' };

  const member = gang.getMember(userId);
  let contributedExp = 0;

  if (gold && gold > 0) {
    const user = await User.findById(userId);
    if (user.gold < gold) return { error: '金币不足' };
    user.gold -= gold;
    await user.save();
    contributedExp += gold;
  }

  if (itemId && itemQuantity > 0) {
    const inv = await Inventory.findOne({ userId, itemId, isEquipped: false });
    if (!inv || inv.quantity < itemQuantity) return { error: '物品不足' };
    if (inv.quantity <= itemQuantity) {
      await Inventory.deleteOne({ _id: inv._id });
    } else {
      inv.quantity -= itemQuantity;
      await inv.save();
    }
    const itemConfig = getItem(itemId);
    // 加入仓库
    const existingWare = gang.warehouse.find(w => w.itemId === itemId);
    if (existingWare) {
      existingWare.quantity += itemQuantity;
    } else {
      gang.warehouse.push({
        itemId,
        itemName: itemConfig?.name || itemId,
        quantity: itemQuantity,
        depositedBy: member.name
      });
    }
    contributedExp += (itemConfig?.price || 10) * itemQuantity;
  }

  member.contribution += contributedExp;
  gang.exp += contributedExp;

  // 检查升级
  if (gang.canLevelUp()) {
    gang.level += 1;
  }

  await gang.save();

  return {
    success: true,
    contributionGained: contributedExp,
    totalContribution: member.contribution,
    gangExp: gang.exp,
    gangLevel: gang.level,
    bonus: gang.getBonus()
  };
}

// 从仓库取物品
async function withdrawFromWarehouse(userId, itemId, quantity) {
  const gang = await Gang.findOne({ 'members.userId': userId });
  if (!gang) return { error: '你未加入任何帮派' };

  const member = gang.getMember(userId);
  const roleRank = { leader: 4, vice_leader: 3, elder: 2, member: 1 };

  const wareItem = gang.warehouse.find(w => w.itemId === itemId);
  if (!wareItem || wareItem.quantity < quantity) return { error: '仓库中物品不足' };

  // 普通成员有每日取用限制（简单实现：最多取5个）
  if (roleRank[member.role] <= 2 && quantity > 5) {
    return { error: '普通成员每日最多取用 5 个物品' };
  }

  if (wareItem.quantity <= quantity) {
    gang.warehouse = gang.warehouse.filter(w => w.itemId !== itemId);
  } else {
    wareItem.quantity -= quantity;
  }
  await gang.save();

  const itemConfig = getItem(itemId);
  let inv = await Inventory.findOne({ userId, itemId });
  if (inv) {
    inv.quantity += quantity;
    await inv.save();
  } else {
    await Inventory.create({ userId, itemId, quantity });
  }

  return {
    success: true,
    itemId,
    itemName: itemConfig?.name || itemId,
    quantity
  };
}

// 搜索帮派
async function searchGangs(query = '') {
  const filter = query ? { name: { $regex: query, $options: 'i' } } : {};
  const gangs = await Gang.find(filter).limit(20).lean();
  return gangs.map(g => ({
    id: g._id,
    name: g.name,
    description: g.description,
    level: g.level,
    memberCount: g.members.length,
    leader: g.members.find(m => m.role === 'leader')?.name || '未知',
    createdAt: g.createdAt
  }));
}

// 帮派聊天
async function sendGangMessage(userId, senderName, content) {
  const gang = await Gang.findOne({ 'members.userId': userId });
  if (!gang) return { error: '你未加入任何帮派' };
  return { gangId: gang._id, gangName: gang.name, senderName, content };
}

module.exports = {
  createGang,
  joinGang,
  leaveGang,
  getGangInfo,
  donateToGang,
  withdrawFromWarehouse,
  searchGangs,
  sendGangMessage
};
