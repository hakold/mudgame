const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  // 频道类型
  channel: {
    type: String,
    enum: ['world', 'faction', 'private', 'system'],
    required: true
  },
  // 发送者
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderName: {
    type: String,
    required: true
  },
  // 接收者（私聊时使用）
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receiverName: {
    type: String
  },
  // 消息内容
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  // 消息类型
  type: {
    type: String,
    enum: ['text', 'system', 'action', 'emote'],
    default: 'text'
  },
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400  // 24小时后自动删除
  }
});

// 索引
ChatMessageSchema.index({ channel: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1, receiverId: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
