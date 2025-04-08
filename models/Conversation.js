const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  isGroup: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    default: null,
    trim: true
  },
  groupAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  groupPhoto: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: '',
    maxlength: 200
  }
}, {
  timestamps: true
});

// Index for faster queries
ConversationSchema.index({ participants: 1 });

// Middleware to prevent duplicate one-on-one conversations
ConversationSchema.pre('save', async function(next) {
  try {
    // Only check for duplicates if it's a new one-on-one conversation
    if (this.isNew && !this.isGroup && this.participants.length === 2) {
      const existingConversation = await this.constructor.findOne({
        isGroup: false,
        participants: { $all: this.participants, $size: 2 }
      });
      
      if (existingConversation) {
        const error = new Error('Conversation between these users already exists');
        error.statusCode = 400;
        return next(error);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Conversation', ConversationSchema);