
// controllers/messageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const mongoose = require('mongoose');
const { encryptMessage, decryptMessage } = require('../utils/encryption');

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, content, contentType = 'text' } = req.body;
    const senderId = req.user._id;

    // Validate conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is part of the conversation
    if (!conversation.participants.includes(senderId)) {
      return res.status(403).json({ 
        message: 'You are not authorized to send messages in this conversation' 
      });
    }

    // Create and encrypt message
    const encryptedContent = encryptMessage(content, process.env.ENCRYPTION_KEY || 'default_encryption_key');
    
    const newMessage = new Message({
      conversationId,
      sender: senderId,
      content: JSON.stringify(encryptedContent),
      contentType,
      encrypted: true
    });

    // Save message
    const savedMessage = await newMessage.save();

    // Update conversation with last message info
    conversation.lastMessage = savedMessage._id;
    
    // Update unread counts for all participants except sender
    conversation.participants.forEach(participant => {
      if (!participant.equals(senderId)) {
        const currentCount = conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });
    
    await conversation.save();

    // Populate sender info for response
    await savedMessage.populate('sender', 'username profilePicture');
    
    // For response, decrypt the message content
    const decryptedMessage = {
      ...savedMessage._doc,
      content: content // Return original content for sender
    };

    res.status(201).json(decryptedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    next(error);
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    // Convert to integers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Validate conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is part of the conversation
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ 
        message: 'You are not authorized to view messages in this conversation' 
      });
    }

    // Get messages with pagination, sorted by newest first
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('sender', 'username profilePicture');

    // Reset unread count for this user
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    // Decrypt messages
    const decryptedMessages = messages.map(message => {
      try {
        if (message.encrypted && message.content) {
          const encryptedData = JSON.parse(message.content);
          const decryptedContent = decryptMessage(encryptedData, process.env.ENCRYPTION_KEY || 'default_encryption_key');
          
          return {
            ...message._doc,
            content: decryptedContent
          };
        }
        return message;
      } catch (error) {
        console.error('Error decrypting message:', error);
        return {
          ...message._doc,
          content: 'Could not decrypt message'
        };
      }
    });

    // Get total count for pagination info
    const totalMessages = await Message.countDocuments({ conversationId });

    res.json({
      messages: decryptedMessages,
      pagination: {
        total: totalMessages,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalMessages / limitNum)
      }
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    next(error);
  }
};

// @desc    Update message status (read/delivered)
// @route   PUT /api/messages/:messageId/status
// @access  Private
const updateMessageStatus = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!['delivered', 'read'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is in the conversation
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to update this message' });
    }

    // Don't allow updating your own messages' status
    if (message.sender.equals(userId)) {
      return res.status(400).json({ message: 'Cannot update status of your own message' });
    }

    // Update status if it's an upgrade (sent -> delivered -> read)
    const statusHierarchy = { sent: 1, delivered: 2, read: 3 };
    if (statusHierarchy[status] > statusHierarchy[message.status]) {
      message.status = status;
    }

    // Add to read by list if status is 'read'
    if (status === 'read' && !message.readBy.some(read => read.user.equals(userId))) {
      message.readBy.push({ user: userId, readAt: Date.now() });
    }

    await message.save();

    res.json({ message: 'Message status updated', status: message.status });
  } catch (error) {
    console.error('Error updating message status:', error);
    next(error);
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender of the message
    if (!message.sender.equals(userId)) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Check if message is the last message in conversation
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation.lastMessage && conversation.lastMessage.equals(message._id)) {
      // Find the previous message to update as last message
      const previousMessage = await Message.findOne({
        conversationId: conversation._id,
        _id: { $ne: message._id }
      }).sort({ createdAt: -1 });

      conversation.lastMessage = previousMessage ? previousMessage._id : null;
      await conversation.save();
    }

    // Perform soft delete by keeping the message but removing content
    message.content = "This message was deleted";
    message.contentType = "text";
    message.fileUrl = null;
    message.fileName = null;
    message.fileSize = null;
    message.encrypted = false;
    await message.save();

    // Alternative: Hard delete the message
    // await Message.deleteOne({ _id: messageId });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    next(error);
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread
// @access  Private
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all conversations user is part of
    const conversations = await Conversation.find({
      participants: userId
    });

    let totalUnread = 0;
    const unreadByConversation = {};

    conversations.forEach(conversation => {
      const unreadCount = conversation.unreadCount.get(userId.toString()) || 0;
      totalUnread += unreadCount;
      unreadByConversation[conversation._id] = unreadCount;
    });

    res.json({
      totalUnread,
      unreadByConversation
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    next(error);
  }
};

// @desc    Search messages in a conversation
// @route   GET /api/messages/:conversationId/search
// @access  Private
const searchMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { query } = req.query;
    const userId = req.user._id;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Check if user has access to this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ message: 'Not authorized to search this conversation' });
    }

    // Search for messages (note: this is simplified since encrypted messages can't be searched directly)
    // In a real implementation with E2E encryption, you'd need to decrypt each message on the client side
    const messages = await Message.find({
      conversationId,
      content: { $regex: query, $options: 'i' },
      encrypted: false // Only search non-encrypted messages in this example
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('sender', 'username profilePicture');

    res.json(messages);
  } catch (error) {
    console.error('Error searching messages:', error);
    next(error);
  }
};

// @desc    Forward a message to another conversation
// @route   POST /api/messages/:messageId/forward
// @access  Private
const forwardMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { targetConversationId } = req.body;
    const userId = req.user._id;

    // Get the original message
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user has access to the original conversation
    const sourceConversation = await Conversation.findOne({
      _id: originalMessage.conversationId,
      participants: userId
    });

    if (!sourceConversation) {
      return res.status(403).json({ message: 'Not authorized to access this message' });
    }

    // Check if user has access to the target conversation
    const targetConversation = await Conversation.findOne({
      _id: targetConversationId,
      participants: userId
    });

    if (!targetConversation) {
      return res.status(403).json({ message: 'Not authorized to send to target conversation' });
    }

    // Create new message with content from original message
    const newMessage = new Message({
      conversationId: targetConversationId,
      sender: userId,
      content: originalMessage.content,
      contentType: originalMessage.contentType,
      fileUrl: originalMessage.fileUrl,
      fileName: originalMessage.fileName,
      fileSize: originalMessage.fileSize,
      encrypted: originalMessage.encrypted,
      forwardedFrom: originalMessage._id
    });

    // Save forwarded message
    const savedMessage = await newMessage.save();

    // Update target conversation's last message
    targetConversation.lastMessage = savedMessage._id;
    
    // Update unread counts for all participants except sender
    targetConversation.participants.forEach(participant => {
      if (!participant.equals(userId)) {
        const currentCount = targetConversation.unreadCount.get(participant.toString()) || 0;
        targetConversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });
    
    await targetConversation.save();

    // Populate sender info
    await savedMessage.populate('sender', 'username profilePicture');

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error forwarding message:', error);
    next(error);
  }
};

// @desc    Handle message reactions (like, love, etc.)
// @route   POST /api/messages/:messageId/react
// @access  Private
const reactToMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user._id;

    // Validate reaction type
    const validReactions = ['like', 'love', 'laugh', 'sad', 'angry', 'thumbsup', 'thumbsdown'];
    if (!validReactions.includes(reaction)) {
      return res.status(400).json({ 
        message: 'Invalid reaction type',
        validReactions
      });
    }

    // Get the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user has access to the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ message: 'Not authorized to react to this message' });
    }

    // Initialize reactions field if it doesn't exist
    if (!message.reactions) {
      message.reactions = [];
    }

    // Check if user already reacted
    const existingReactionIndex = message.reactions.findIndex(
      r => r.user.toString() === userId.toString()
    );

    if (existingReactionIndex > -1) {
      // Update existing reaction
      message.reactions[existingReactionIndex].type = reaction;
    } else {
      // Add new reaction
      message.reactions.push({
        user: userId,
        type: reaction
      });
    }

    await message.save();

    res.json({ message: 'Reaction added', reactions: message.reactions });
  } catch (error) {
    console.error('Error adding reaction:', error);
    next(error);
  }
};

// @desc    Remove a reaction from a message
// @route   DELETE /api/messages/:messageId/react
// @access  Private
const removeReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Get the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user has access to the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ message: 'Not authorized to modify this message' });
    }

    // Remove reaction if exists
    if (message.reactions && message.reactions.length > 0) {
      message.reactions = message.reactions.filter(
        reaction => reaction.user.toString() !== userId.toString()
      );
      await message.save();
    }

    res.json({ message: 'Reaction removed', reactions: message.reactions });
  } catch (error) {
    console.error('Error removing reaction:', error);
    next(error);
  }
};

module.exports = {
  sendMessage,
  getMessages,
  updateMessageStatus,
  deleteMessage,
  getUnreadCount,
  searchMessages,
  forwardMessage,
  reactToMessage,
  removeReaction
};