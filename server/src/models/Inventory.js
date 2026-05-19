const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemId: {
    type: String,
    required: true  // 物品配置ID
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  // 装备特有属性
  isEquipped: {
    type: Boolean,
    default: false
  },
  equipSlot: {
    type: String,
    enum: ['weapon', 'armor', 'helmet', 'boots', 'accessory', 'ring', null],
    default: null
  },
  // 强化等级
  enhanceLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  // 附加属性（随机生成）
  extraAttributes: [{
    name: String,
    value: Number
  }],
  // 耐久度
  durability: {
    current: { type: Number, default: 100 },
    max: { type: Number, default: 100 }
  },
  // 获取时间
  obtainedAt: {
    type: Date,
    default: Date.now
  }
});

// 获取物品配置
InventorySchema.methods.getItemConfig = function() {
  const itemConfigs = require('../../../config/json/items.json');
  return itemConfigs.find(i => i.id === this.itemId);
};

function isEquipmentType(type) {
  return type === 'weapon' || type === 'armor' || type === 'equipment';
}

// 计算装备属性加成
InventorySchema.methods.calculateAttributes = function() {
  // 耐久归零则装备失效
  if (this.durability?.current != null && this.durability.current <= 0) return {};

  const config = this.getItemConfig();
  if (!config) return {};

  const result = { ...(config.attributes || config.stats || {}) };
  
  // 强化加成
  if (this.enhanceLevel > 0) {
    const enhanceRatio = 1 + this.enhanceLevel * 0.1;
    for (const attr in result) {
      result[attr] = Math.floor(result[attr] * enhanceRatio);
    }
  }
  
  // 附加属性
  for (const extra of this.extraAttributes) {
    result[extra.name] = (result[extra.name] || 0) + extra.value;
  }
  
  return result;
};

// 检查是否可装备
InventorySchema.methods.canEquip = function(user) {
  const config = this.getItemConfig();
  if (!config || !isEquipmentType(config.type)) return false;
  
  // 检查等级需求
  if (config.requireLevel && user.level < config.requireLevel) return false;
  
  // 检查属性需求
  if (config.requireAttributes) {
    for (const attr in config.requireAttributes) {
      if (user.attributes[attr] < config.requireAttributes[attr]) return false;
    }
  }
  
  return true;
};

// 装备
InventorySchema.methods.equip = function(slot) {
  this.isEquipped = true;
  this.equipSlot = slot;
};

// 卸下
InventorySchema.methods.unequip = function() {
  this.isEquipped = false;
  this.equipSlot = null;
};

// 修复耐久
InventorySchema.methods.repair = function(amount) {
  this.durability.current = Math.min(this.durability.current + amount, this.durability.max);
};

// 使用耐久
InventorySchema.methods.useDurability = function(amount) {
  this.durability.current = Math.max(this.durability.current - amount, 0);
  return this.durability.current > 0;
};

InventorySchema.index({ userId: 1, itemId: 1 });
InventorySchema.index({ userId: 1, isEquipped: 1 });

module.exports = mongoose.model('Inventory', InventorySchema);
