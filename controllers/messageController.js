// controllers/messageController.js
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');
const { encryptMessage, decryptMessage } = require('../utils/encryption');

// @desc    Send a message directly to user
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

    // Create and encrypt message
    const encryptedContent = encryptMessage(content, process.env.ENCRYPTION_KEY || 'default_encryption_key');
    
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content: JSON.stringify(encryptedContent),
      contentType,
      encrypted: true
    });

    // Save message
    const savedMessage = await newMessage.save();

    // Populate sender info for response
    await savedMessage.populate('sender', 'username profilePicture');
    await savedMessage.populate('receiver', 'username profilePicture');
    
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

// @desc    Get messages between current user and another user
// @route   GET /api/messages/user/:userId
// @access  Private
const getMessagesByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user._id;

    // Convert to integers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Verify user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get messages between the two users (in either direction)
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    // Mark messages as read
    await Message.updateMany(
      { 
        sender: userId, 
        receiver: currentUserId,
        status: { $ne: 'read' }
      },
      { 
        $set: { 
          status: 'read',
          readAt: Date.now() 
        }
      }
    );

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
    const totalMessages = await Message.countDocuments({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    });

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

// @desc    Get recent conversations (users the current user has messaged with)
// @route   GET /api/messages/conversations
// @access  Private
const getRecentConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all users the current user has exchanged messages with
    const messagePartners = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) },
            { receiver: new mongoose.Types.ObjectId(userId) }

          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ['$receiver', mongoose.Types.ObjectId(userId)] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get user details for each conversation partner
    const userIds = messagePartners.map(partner => partner._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('username profilePicture status lastSeen');

    // Combine message data with user data
    const conversations = messagePartners.map(partner => {
      const user = users.find(u => u._id.toString() === partner._id.toString());
      if (!user) return null;

      const lastMessage = partner.lastMessage;
      let content = lastMessage.content;

      // Decrypt the last message if needed
      if (lastMessage.encrypted && lastMessage.content) {
        try {
          const encryptedData = JSON.parse(lastMessage.content);
          content = decryptMessage(encryptedData, process.env.ENCRYPTION_KEY || 'default_encryption_key');
        } catch (err) {
          content = 'Could not decrypt message';
        }
      }

      return {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        status: user.status,
        lastSeen: user.lastSeen,
        lastMessage: {
          _id: lastMessage._id,
          content: content,
          contentType: lastMessage.contentType,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt
        },
        unreadCount: partner.unreadCount,
        messageCount: partner.messageCount
      };
    }).filter(Boolean);

    res.json(conversations);
  } catch (error) {
    console.error('Error getting recent conversations:', error);
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

    // Perform soft delete by keeping the message but removing content
    message.content = "This message was deleted";
    message.contentType = "text";
    message.fileUrl = null;
    message.fileName = null;
    message.fileSize = null;
    message.encrypted = false;
    await message.save();

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

    // Get total unread count
    const totalUnread = await Message.countDocuments({
      receiver: userId,
      status: { $ne: 'read' }
    });

    // Get unread count by sender
    const unreadBySender = await Message.aggregate([
      {
        $match: {
          receiver: mongoose.Types.ObjectId(userId),
          status: { $ne: 'read' }
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to format that's easy to use on frontend
    const unreadByUser = {};
    unreadBySender.forEach(item => {
      unreadByUser[item._id] = item.count;
    });

    res.json({
      totalUnread,
      unreadByUser
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    next(error);
  }
};

// @desc    Search messages
// @route   GET /api/messages/search
// @access  Private
const searchMessages = async (req, res, next) => {
  try {
    const { query, userId } = req.query;
    const currentUserId = req.user._id;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Build base query
    let messageQuery = {
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId }
      ],
      encrypted: false, // Only search non-encrypted messages
      content: { $regex: query, $options: 'i' }
    };

    // If userId is provided, restrict search to messages between these users
    if (userId) {
      messageQuery = {
        $or: [
          { sender: currentUserId, receiver: userId },
          { sender: userId, receiver: currentUserId }
        ],
        encrypted: false,
        content: { $regex: query, $options: 'i' }
      };
    }

    // Search for messages
    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    res.json(messages);
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