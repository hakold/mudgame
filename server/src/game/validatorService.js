// 输入验证服务 — 所有客户端输入不可信，服务端严格校验

const { getItem, getSkill, getQuest, getRoom, getFaction, getFactionQuest, getForgeRecipe } = require('./index');

// 安全字符串：防止注入、限制长度
function safeString(val, maxLen = 200) {
  if (typeof val !== 'string') return null;
  const cleaned = val.replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  if (cleaned.length === 0 || cleaned.length > maxLen) return null;
  return cleaned;
}

function safeId(val) {
  if (typeof val !== 'string') return null;
  // 只允许字母数字下划线连字符点
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(val)) return null;
  if (val.length > 64) return null;
  return val;
}

function safeInt(val, min = 0, max = 999999) {
  if (typeof val !== 'number' || !Number.isFinite(val) || !Number.isInteger(val)) return null;
  if (val < min || val > max) return null;
  return val;
}

// 各Socket事件输入schema
const validators = {
  move: (data) => {
    const dir = safeString(data.direction, 20);
    if (!dir) return '无效方向';
    const validDirs = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down', 'enter', 'out'];
    if (!validDirs.includes(dir.toLowerCase())) return `无效方向: ${dir}`;
    return null;
  },

  battle_start: (data) => {
    const targetId = safeId(data.targetId);
    if (!targetId) return '无效目标ID';
    const type = safeString(data.type, 10);
    if (!type || !['pve', 'pvp'].includes(type)) return '无效战斗类型';
    return null;
  },

  battle_action: (data) => {
    const battleId = safeId(data.battleId);
    if (!battleId) return '无效战斗ID';
    const action = safeString(data.action, 10);
    if (!action || !['attack', 'skill', 'defend', 'flee'].includes(action)) return '无效战斗动作';
    if (action === 'skill') {
      const skillId = safeId(data.skillId);
      if (!skillId || !getSkill(skillId)) return '无效技能';
    }
    return null;
  },

  buy_item: (data) => {
    const itemId = safeId(data.itemId);
    if (!itemId || !getItem(itemId)) return '物品不存在';
    const qty = safeInt(data.quantity || 1, 1, 99);
    if (qty === null) return '无效数量';
    return null;
  },

  sell_item: (data) => {
    const itemId = safeId(data.itemId);
    if (!itemId) return '无效物品ID';
    const qty = safeInt(data.quantity || 1, 1, 999);
    if (qty === null) return '无效数量';
    return null;
  },

  chat_world: (data) => {
    const content = safeString(data.content, 500);
    if (!content) return '消息内容无效';
    return null;
  },
  chat_room: (data) => {
    const content = safeString(data.content, 500);
    if (!content) return '消息内容无效';
    return null;
  },
  chat_private: (data) => {
    const content = safeString(data.content, 500);
    if (!content) return '消息内容无效';
    if (!data.targetName && !data.targetId) return '未指定目标';
    return null;
  },
  chat_gang: (data) => {
    const content = safeString(data.content, 500);
    if (!content) return '消息内容无效';
    return null;
  },

  trade_request: (data) => {
    const targetName = safeString(data.targetName, 12);
    if (!targetName) return '无效目标';
    return null;
  },
  trade_add_item: (data) => {
    const tradeId = safeId(data.tradeId);
    if (!tradeId) return '无效交易ID';
    const itemId = safeId(data.itemId);
    if (!itemId) return '无效物品';
    const qty = safeInt(data.quantity || 1, 1, 999);
    if (qty === null) return '无效数量';
    return null;
  },
  trade_set_gold: (data) => {
    const tradeId = safeId(data.tradeId);
    if (!tradeId) return '无效交易ID';
    const gold = safeInt(data.gold || 0, 0, 9999999);
    if (gold === null) return '无效金币';
    return null;
  },
  trade_confirm: (data) => {
    const tradeId = safeId(data.tradeId);
    if (!tradeId) return '无效交易ID';
    return null;
  },
  trade_cancel: (data) => {
    const tradeId = safeId(data.tradeId);
    if (!tradeId) return '无效交易ID';
    return null;
  },
  trade_remove_item: (data) => {
    const tradeId = safeId(data.tradeId);
    if (!tradeId) return '无效交易ID';
    const itemId = safeId(data.itemId);
    if (!itemId) return '无效物品';
    return null;
  },

  pickup_item: (data) => {
    const itemId = safeId(data.itemId);
    if (!itemId) return '无效物品ID';
    const qty = safeInt(data.quantity || 1, 1, 99);
    if (qty === null) return '无效数量';
    return null;
  },

  learn_skill: (data) => {
    const skillId = safeId(data.skillId);
    if (!skillId || !getSkill(skillId)) return '技能不存在';
    return null;
  },

  train_stat: (data) => {
    const stat = safeString(data.stat, 20);
    const validStats = ['strength', 'dexterity', 'constitution', 'intelligence', '力量', '敏捷', '体质', '悟性'];
    if (!stat || !validStats.includes(stat)) return '无效属性';
    return null;
  },

  allocate_points: (data) => {
    const stat = safeString(data.stat, 20);
    const validStats = ['strength', 'dexterity', 'constitution', 'intelligence', '力量', '敏捷', '体质', '悟性'];
    if (!stat || !validStats.includes(stat)) return '无效属性';
    const pts = safeInt(data.points || 1, 1, 100);
    if (pts === null) return '无效点数';
    return null;
  },

  accept_quest: (data) => {
    const questId = safeId(data.questId);
    if (!questId || !getQuest(questId)) return '任务不存在';
    return null;
  },
  complete_quest: (data) => {
    const questId = safeId(data.questId);
    if (!questId) return '无效任务ID';
    return null;
  },

  join_faction: (data) => {
    const factionId = safeId(data.factionId);
    if (!factionId || !getFaction(factionId)) return '门派不存在';
    return null;
  },

  accept_faction_quest: (data) => {
    const questId = safeId(data.questId);
    if (!questId || !getFactionQuest(questId)) return '门派任务不存在';
    return null;
  },
  complete_faction_quest: (data) => {
    const questId = safeId(data.questId);
    if (!questId) return '无效任务ID';
    return null;
  },

  gather: (data) => {
    const nodeId = safeId(data.nodeId);
    if (!nodeId) return '无效采集点';
    return null;
  },
  alchemy: (data) => {
    const recipeId = safeId(data.recipeId);
    if (!recipeId) return '无效配方';
    return null;
  },
  cooking: (data) => {
    const recipeId = safeId(data.recipeId);
    if (!recipeId) return '无效配方';
    return null;
  },
  forge: (data) => {
    const recipeId = safeId(data.recipeId);
    if (!recipeId || !getForgeRecipe(recipeId)) return '锻造配方不存在';
    return null;
  },

  auction_create: (data) => {
    const itemId = safeId(data.itemId);
    if (!itemId) return '无效物品';
    const qty = safeInt(data.quantity || 1, 1, 999);
    if (qty === null) return '无效数量';
    const price = safeInt(data.unitPrice || 0, 1, 99999999);
    if (price === null) return '无效单价';
    if (![24, 48, 72].includes(data.duration || 24)) return '无效时长';
    return null;
  },
  auction_buy: (data) => {
    const listingId = safeId(data.listingId);
    if (!listingId) return '无效挂单ID';
    return null;
  },
  auction_cancel: (data) => {
    const listingId = safeId(data.listingId);
    if (!listingId) return '无效挂单ID';
    return null;
  },

  pvp_challenge: (data) => {
    const targetName = safeString(data.targetName, 12);
    if (!targetName) return '无效目标';
    return null;
  },

  enter_dungeon: (data) => {
    const dungeonId = safeId(data.dungeonId);
    if (!dungeonId) return '无效副本ID';
    return null;
  },

  gang_create: (data) => {
    const name = safeString(data.name, 12);
    if (!name || name.length < 2) return '帮派名称需2-12字符';
    return null;
  },
  gang_join: (data) => {
    const gangName = safeString(data.gangName, 12);
    if (!gangName) return '无效帮派名称';
    return null;
  },
  gang_donate: (data) => {
    const gold = safeInt(data.gold || 0, 0, 99999999);
    if (gold === null) return '无效金币';
    if (data.itemId) {
      const itemId = safeId(data.itemId);
      if (!itemId || !getItem(itemId)) return '物品不存在';
    }
    return null;
  },
  gang_withdraw: (data) => {
    const itemId = safeId(data.itemId);
    if (!itemId) return '无效物品';
    const qty = safeInt(data.quantity || 1, 1, 999);
    if (qty === null) return '无效数量';
    return null;
  },

  repair_item: (data) => {
    const inventoryId = safeId(data.inventoryId);
    if (!inventoryId) return '无效物品ID';
    return null;
  }
};

// 验证事件输入，返回错误消息或null
function validateEvent(eventName, data) {
  const validator = validators[eventName];
  if (!validator) {
    // 未定义验证器的事件（只读查询类），允许通过
    if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) return null;
    if (data === undefined || data === null) return null;
    return null; // 未注册的事件不做严格校验
  }
  return validator(data || {});
}

module.exports = { validateEvent, safeString, safeId, safeInt };
