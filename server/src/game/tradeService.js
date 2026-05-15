// 玩家间交易服务
// 支持同一房间内玩家发起交易请求、放入物品/金币、双方确认后交换

class TradeService {
  constructor() {
    // tradeId -> { initiator, receiver, initiatorOffer, receiverOffer, initiatorConfirmed, receiverConfirmed, status, createdAt }
    this.activeTrades = new Map();
    this.tradeCounter = 0;
  }

  // 创建交易
  createTrade(initiatorSocketId, initiatorUserId, initiatorName, receiverSocketId, receiverUserId, receiverName) {
    // 检查双方是否已在交易中
    for (const [, trade] of this.activeTrades) {
      if (trade.status !== 'completed' && trade.status !== 'cancelled') {
        if (trade.initiator.userId === initiatorUserId || trade.receiver.userId === initiatorUserId ||
            trade.initiator.userId === receiverUserId || trade.receiver.userId === receiverUserId) {
          return { error: '双方中有人正在交易中' };
        }
      }
    }

    const tradeId = `trade_${++this.tradeCounter}_${Date.now()}`;
    this.activeTrades.set(tradeId, {
      tradeId,
      initiator: { socketId: initiatorSocketId, userId: initiatorUserId, name: initiatorName },
      receiver: { socketId: receiverSocketId, userId: receiverUserId, name: receiverName },
      initiatorOffer: { items: [], gold: 0 },
      receiverOffer: { items: [], gold: 0 },
      initiatorConfirmed: false,
      receiverConfirmed: false,
      status: 'pending', // pending, confirmed, completed, cancelled
      createdAt: new Date()
    });

    return { tradeId };
  }

  // 添加物品到交易
  addItem(tradeId, userId, itemId, itemName, quantity = 1) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'pending') return { error: '交易不存在或已结束' };

    const isInitiator = trade.initiator.userId.toString() === userId.toString();
    const offer = isInitiator ? trade.initiatorOffer : trade.receiverOffer;
    
    // 重置确认状态
    trade.initiatorConfirmed = false;
    trade.receiverConfirmed = false;

    const existing = offer.items.find(i => i.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      offer.items.push({ itemId, itemName, quantity });
    }

    return this.getTradeState(tradeId);
  }

  // 设置金币
  setGold(tradeId, userId, gold) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'pending') return { error: '交易不存在或已结束' };

    const isInitiator = trade.initiator.userId.toString() === userId.toString();
    if (isInitiator) {
      trade.initiatorOffer.gold = gold;
    } else {
      trade.receiverOffer.gold = gold;
    }

    // 重置确认状态
    trade.initiatorConfirmed = false;
    trade.receiverConfirmed = false;

    return this.getTradeState(tradeId);
  }

  // 确认交易
  confirm(tradeId, userId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'pending') return { error: '交易不存在或已结束' };

    const isInitiator = trade.initiator.userId.toString() === userId.toString();
    if (isInitiator) {
      trade.initiatorConfirmed = true;
    } else {
      trade.receiverConfirmed = true;
    }

    // 双方都确认则完成
    if (trade.initiatorConfirmed && trade.receiverConfirmed) {
      trade.status = 'completed';
      return { completed: true, ...this.getTradeState(tradeId) };
    }

    return this.getTradeState(tradeId);
  }

  // 取消交易
  cancel(tradeId, userId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return { error: '交易不存在' };

    trade.status = 'cancelled';
    return { cancelled: true };
  }

  // 移除物品
  removeItem(tradeId, userId, itemId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'pending') return { error: '交易不存在或已结束' };

    const isInitiator = trade.initiator.userId.toString() === userId.toString();
    const offer = isInitiator ? trade.initiatorOffer : trade.receiverOffer;
    offer.items = offer.items.filter(i => i.itemId !== itemId);

    trade.initiatorConfirmed = false;
    trade.receiverConfirmed = false;

    return this.getTradeState(tradeId);
  }

  // 获取交易状态
  getTradeState(tradeId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return null;

    return {
      tradeId: trade.tradeId,
      initiator: { name: trade.initiator.name, offer: trade.initiatorOffer, confirmed: trade.initiatorConfirmed },
      receiver: { name: trade.receiver.name, offer: trade.receiverOffer, confirmed: trade.receiverConfirmed },
      status: trade.status
    };
  }

  // 获取玩家的活跃交易
  getPlayerTrade(userId) {
    for (const [, trade] of this.activeTrades) {
      if (trade.status === 'pending' && 
          (trade.initiator.userId.toString() === userId.toString() || 
           trade.receiver.userId.toString() === userId.toString())) {
        return this.getTradeState(trade.tradeId);
      }
    }
    return null;
  }

  // 清理过期交易（超过5分钟未完成）
  cleanup() {
    const now = new Date();
    for (const [tradeId, trade] of this.activeTrades) {
      if (trade.status !== 'pending') {
        // 已完成/已取消的交易保留1分钟后清理
        if (now - trade.updatedAt > 60000) {
          this.activeTrades.delete(tradeId);
        }
        continue;
      }
      if (now - trade.createdAt > 300000) { // 5分钟超时
        trade.status = 'cancelled';
      }
    }
  }
}

module.exports = new TradeService();
