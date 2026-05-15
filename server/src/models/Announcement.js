const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  // 公告标题
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  // 公告内容
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  // 公告类型
  type: {
    type: String,
    enum: ['normal', 'important', 'urgent', 'event'],
    default: 'normal'
  },
  // 是否置顶
  pinned: {
    type: Boolean,
    default: false
  },
  // 发布者
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  authorName: {
    type: String
  },
  // 有效期
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  // 状态
  status: {
    type: String,
    enum: ['draft', 'published', 'expired'],
    default: 'published'
  },
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
AnnouncementSchema.index({ status: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
