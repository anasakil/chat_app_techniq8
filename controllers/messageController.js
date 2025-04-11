// controllers/messageController.js
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Send a message directly to user (socket only, no DB storage)
// @route   POST /api/messages/send
// @access  Private
const sendDirectMessage = async (req, res, next) => {
  try {
    const { receiverId, content, contentType = 'text', tempId } = req.body;
    const senderId = req.user._id;

    // Basic validation
    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver ID and content are required' });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Check if receiver has blocked sender
    if (receiver.blockedUsers && receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({ message: 'Cannot send message to this user' });
    }

    // Generate a real message ID (but don't actually store in DB)
    const messageId = tempId || new mongoose.Types.ObjectId().toString();

    // Create response with sender and receiver info
    const messageResponse = {
      _id: messageId,
      sender: {
        _id: req.user._id,
        username: req.user.username,
        profilePicture: req.user.profilePicture || '',
        status: req.user.status || 'offline'
      },
      receiver: {
        _id: receiver._id,
        username: receiver.username,
        profilePicture: receiver.profilePicture || '',
        status: receiver.status || 'offline'
      },
      content: content,
      contentType: contentType,
      status: 'sent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // If there was a tempId in the request, notify socket server about ID change
    if (tempId && tempId !== messageId) {
      // Emit socket event for ID change if needed
      if (req.io) {
        req.io.to(req.user._id.toString()).emit('message_id_assigned', {
          tempId: tempId,
          serverId: messageId
        });
      }
    }

    res.status(201).json(messageResponse);
  } catch (error) {
    console.error('Error handling message:', error);
    next(error);
  }
};

// @desc    Get messages between current user and another user
// @route   GET /api/messages/user/:userId
// @access  Private
// This endpoint now only verifies the user exists but doesn't fetch messages
const getMessagesByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return empty messages array since messages are stored locally
    res.json({
      messages: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        pages: 0
      }
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    next(error);
  }
};

// @desc    Get recent conversations (users the current user has messaged with)
// @route   GET /api/messages/conversations
// @access  Private
const getRecentConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all contacts from the user's contacts list
    const currentUser = await User.findById(userId).populate('contacts', 'username profilePicture status lastSeen');
    
    // If no contacts, return empty array
    if (!currentUser || !currentUser.contacts || currentUser.contacts.length === 0) {
      return res.json([]);
    }

    // Map contacts to conversation format
    const conversations = currentUser.contacts.map(contact => {
      return {
        _id: contact._id,
        username: contact.username,
        profilePicture: contact.profilePicture || '',
        status: contact.status || 'offline',
        lastSeen: contact.lastSeen || new Date(),
        // No actual message data since they're stored locally
        lastMessage: null,
        unreadCount: 0,
        participants: [
          { _id: userId },
          { _id: contact._id }
        ],
        isGroup: false,
        updatedAt: new Date().toISOString()
      };
    });

    res.json(conversations);
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    next(error);
  }
};

// @desc    Mark a message as delivered/read (only emits socket event)
// @route   PUT /api/messages/:messageId/status
// @access  Private
const updateMessageStatus = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { status, senderId } = req.body;
    
    if (!['delivered', 'read'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    // Emit socket event for status update
    if (req.io && senderId) {
      req.io.to(senderId).emit('message_status_update', {
        messageId,
        status,
        userId: req.user._id
      });
    }
    
    // No DB update, just return success
    res.json({ 
      message: 'Status updated',
      messageId,
      status
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    next(error);
  }
};

// @desc    Mark all messages from a user as read
// @route   PUT /api/messages/read-all/:userId
// @access  Private
const markAllMessagesAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Emit socket event for all messages read
    if (req.io) {
      req.io.to(userId).emit('all_messages_read', {
        senderId: userId,
        receiverId: req.user._id,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ message: 'All messages marked as read' });
  } catch (error) {
    console.error('Error marking all messages as read:', error);
    next(error);
  }
};

// @desc    Get unread message count (always returns 0 since counts managed locally)
// @route   GET /api/messages/unread
// @access  Private
const getUnreadCount = async (req, res, next) => {
  // Return 0 unread since counts are handled locally
  res.json({
    totalUnread: 0,
    unreadByUser: {}
  });
};

module.exports = {
  sendDirectMessage,
  getMessagesByUser,
  getRecentConversations,
  updateMessageStatus,
  markAllMessagesAsRead,
  getUnreadCount
};