// 房间地面掉落物品管理
// 掉落物品不直接进入背包，而是放在房间地面上供玩家拾取

class RoomDropsService {
  constructor() {
    // roomId -> [{ itemId, name, quantity, droppedBy, droppedAt }]
    this.roomDrops = new Map();
  }

  // 在房间添加掉落物品
  addDrop(roomId, itemId, name, quantity = 1, droppedBy = null) {
    if (!this.roomDrops.has(roomId)) {
      this.roomDrops.set(roomId, []);
    }

    const drops = this.roomDrops.get(roomId);
    
    // 同类物品堆叠
    const existing = drops.find(d => d.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      drops.push({
        itemId,
        name,
        quantity,
        droppedBy,
        droppedAt: new Date()
      });
    }
  }

  // 获取房间所有掉落物品
  getDrops(roomId) {
    return this.roomDrops.get(roomId) || [];
  }

  // 拾取物品
  pickupItem(roomId, itemId, quantity = 1) {
    const drops = this.roomDrops.get(roomId);
    if (!drops) return null;

    const drop = drops.find(d => d.itemId === itemId);
    if (!drop) return null;

    const pickupQuantity = Math.min(quantity, drop.quantity);
    const result = {
      itemId: drop.itemId,
      name: drop.name,
      quantity: pickupQuantity
    };

    drop.quantity -= pickupQuantity;
    if (drop.quantity <= 0) {
      const index = drops.indexOf(drop);
      drops.splice(index, 1);
    }

    // 清理空房间
    if (drops.length === 0) {
      this.roomDrops.delete(roomId);
    }

    return result;
  }

  // 清理过期掉落（超过30分钟）
  cleanupExpired() {
    const now = Date.now();
    const expireMs = 30 * 60 * 1000;

    for (const [roomId, drops] of this.roomDrops) {
      const filtered = drops.filter(d => now - new Date(d.droppedAt).getTime() < expireMs);
      if (filtered.length === 0) {
        this.roomDrops.delete(roomId);
      } else if (filtered.length !== drops.length) {
        this.roomDrops.set(roomId, filtered);
      }
    }
  }
}

module.exports = new RoomDropsService();
