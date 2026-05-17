const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, required: true },
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 1 },
  totalPrice: { type: Number, required: true },
  duration: { type: Number, default: 24 }, // hours: 24/48/72
  status: { type: String, enum: ['active', 'sold', 'cancelled', 'expired'], default: 'active' },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  buyerName: { type: String, default: null },
  listingFee: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  soldAt: { type: Date, default: null }
});

AuctionSchema.index({ status: 1, expiresAt: 1 });
AuctionSchema.index({ sellerId: 1, status: 1 });
AuctionSchema.index({ itemId: 1, status: 1 });
AuctionSchema.index({ itemName: 'text' });

// 检查是否过期
AuctionSchema.methods.isExpired = function() {
  return this.status === 'active' && Date.now() >= this.expiresAt;
};

module.exports = mongoose.model('Auction', AuctionSchema);
