// controllers/messageController.js - Modified to skip DB operations
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Send a message directly to user (Socket only, no DB save)
// @route   POST /api/messages/send
// @access  Private
const sendDirectMessage = async (req, res, next) => {
  try {
    const { receiverId, content, contentType = 'text' } = req.body;
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

    // Generate a temporary ID for the message (normally the DB would do this)
    const messageId = new mongoose.Types.ObjectId().toString();

    // Return success with message details but do NOT save to database
    const messageData = {
      _id: messageId,
      sender: senderId,
      receiver: receiverId,
      content: content,
      contentType,
      createdAt: new Date().toISOString(),
      status: 'sent'
    };

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Error processing message request:', error);
    next(error);
  }
};

// @desc    Get messages between current user and another user (return empty since not saving)
// @route   GET /api/messages/user/:userId
// @access  Private
const getMessagesByUser = async (req, res, next) => {
  try {
    // Since we're not storing messages in the database, just return an empty array
    // The client will use its temporary storage instead
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
    // Since we're not storing messages in the database, just return an empty array
    // The client will use its temporary storage instead
    res.json([]);
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    next(error);
  }
};

// @desc    Delete a message (No-op since not saving to DB)
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res, next) => {
  try {
    // Since we're not storing messages in the database, just return success
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    next(error);
  }
};

// @desc    Get unread message count (No-op since not saving to DB)
// @route   GET /api/messages/unread
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    // Since we're not storing messages in the database, return zero counts
    res.json({
      totalUnread: 0,
      unreadByUser: {}
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    next(error);
  }
};

// @desc    Search messages (No-op since not saving to DB)
// @route   GET /api/messages/search
// @access  Private
const searchMessages = async (req, res, next) => {
  try {
    // Since we're not storing messages in the database, just return an empty array
    res.json([]);
  } catch (error) {
    console.error('Error searching messages:', error);
    next(error);
  }
};

module.exports = {
  sendDirectMessage,
  getMessagesByUser,
  getRecentConversations,
  deleteMessage,
  getUnreadCount,
  searchMessages
};