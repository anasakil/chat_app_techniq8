// controllers/conversationController.js
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// @desc    Get conversations for current user
// @route   GET /api/conversations
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all conversations where the current user is a participant
    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'username profilePicture status lastSeen')
      .populate('lastMessage')
      .populate('groupAdmin', 'username')
      .sort({ updatedAt: -1 });

    // Format the response to include conversation name and unread count
    const formattedConversations = conversations.map(conversation => {
      // For group conversations, use the group name
      // For one-on-one, use the other participant's name
      let conversationName = conversation.groupName;
      let participants = conversation.participants;
      let profilePicture = null;

      if (!conversation.isGroup) {
        const otherParticipant = participants.find(
          participant => !participant._id.equals(userId)
        );
        
        if (otherParticipant) {
          conversationName = otherParticipant.username;
          profilePicture = otherParticipant.profilePicture;
        }
      }

      // Get unread count for current user
      const unreadCount = conversation.unreadCount.get(userId.toString()) || 0;

      return {
        _id: conversation._id,
        name: conversationName,
        participants: participants,
        isGroup: conversation.isGroup,
        groupAdmin: conversation.groupAdmin,
        lastMessage: conversation.lastMessage,
        unreadCount: unreadCount,
        profilePicture: profilePicture,
        updatedAt: conversation.updatedAt
      };
    });

    res.json(formattedConversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    next(error);
  }
};

// @desc    Create a new conversation
// @route   POST /api/conversations
// @access  Private
const createConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { participants, isGroup, groupName } = req.body;

    // Validate participants
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: 'Participants are required' });
    }

    // Convert string IDs to ObjectIds and ensure they're valid
    const participantIds = [userId.toString(), ...participants].map(id => {
      try {
        return new ObjectId(id);
      } catch (error) {
        throw new Error(`Invalid participant ID: ${id}`);
      }
    });

    // Remove duplicates
    const uniqueParticipantIds = [...new Set(participantIds.map(id => id.toString()))].map(id => new ObjectId(id));

    // Verify all participants exist
    const usersExist = await User.find({ _id: { $in: uniqueParticipantIds } });
    if (usersExist.length !== uniqueParticipantIds.length) {
      return res.status(404).json({ message: 'One or more participants not found' });
    }

    // For one-on-one conversations, check if it already exists
    if (!isGroup && uniqueParticipantIds.length === 2) {
      const existingConversation = await Conversation.findOne({
        isGroup: false,
        participants: { $all: uniqueParticipantIds, $size: 2 }
      })
        .populate('participants', 'username profilePicture status lastSeen')
        .populate('lastMessage');

      if (existingConversation) {
        return res.status(200).json(existingConversation);
      }
    }

    // Create new conversation
    const newConversation = new Conversation({
      participants: uniqueParticipantIds,
      isGroup: isGroup || false,
      groupName: isGroup ? groupName : null,
      groupAdmin: isGroup ? userId : null
    });

    // Initialize unread counts to zero for all participants
    uniqueParticipantIds.forEach(participantId => {
      newConversation.unreadCount.set(participantId.toString(), 0);
    });

    const savedConversation = await newConversation.save();

    // Populate participants data
    await savedConversation.populate('participants', 'username profilePicture status lastSeen');

    res.status(201).json(savedConversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    next(error);
  }
};

// @desc    Get a single conversation
// @route   GET /api/conversations/:id
// @access  Private
const getConversationById = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id)
      .populate('participants', 'username profilePicture status lastSeen')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username profilePicture'
        }
      });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is a participant
    if (!conversation.participants.some(p => p._id.equals(userId))) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    next(error);
  }
};

// @desc    Delete a conversation
// @route   DELETE /api/conversations/:id
// @access  Private
const deleteConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to delete this conversation' });
    }

    // For group chats, only admin can delete
    if (conversation.isGroup && !conversation.groupAdmin.equals(userId)) {
      return res.status(403).json({ message: 'Only group admin can delete group conversations' });
    }

    // Delete all messages in this conversation
    await Message.deleteMany({ conversationId: id });

    // Delete the conversation
    await Conversation.findByIdAndDelete(id);

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    next(error);
  }
};

// @desc    Add participant to group conversation
// @route   POST /api/conversations/:id/participants
// @access  Private
const addParticipant = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { participantId } = req.body;

    // Validate participant ID
    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if it's a group conversation
    if (!conversation.isGroup) {
      return res.status(400).json({ message: 'Cannot add participants to non-group conversations' });
    }

    // Check if user is admin
    if (!conversation.groupAdmin.equals(userId)) {
      return res.status(403).json({ message: 'Only group admin can add participants' });
    }

    // Check if participant already exists
    if (conversation.participants.includes(participantId)) {
      return res.status(400).json({ message: 'User is already in this conversation' });
    }

    // Add participant
    conversation.participants.push(new ObjectId(participantId));
    conversation.unreadCount.set(participantId, 0);
    
    await conversation.save();

    // Populate and return the updated conversation
    const updatedConversation = await Conversation.findById(id)
      .populate('participants', 'username profilePicture status lastSeen')
      .populate('groupAdmin', 'username')
      .populate('lastMessage');

    res.json(updatedConversation);
  } catch (error) {
    console.error('Error adding participant:', error);
    next(error);
  }
};

// @desc    Remove participant from group conversation
// @route   DELETE /api/conversations/:id/participants/:participantId
// @access  Private
const removeParticipant = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id, participantId } = req.params;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if it's a group conversation
    if (!conversation.isGroup) {
      return res.status(400).json({ message: 'Cannot remove participants from non-group conversations' });
    }

    // Only admin can remove others, but users can remove themselves
    if (!conversation.groupAdmin.equals(userId) && !userId.equals(participantId)) {
      return res.status(403).json({ message: 'Only group admin can remove other participants' });
    }

    // Check if participant exists in conversation
    if (!conversation.participants.some(p => p.equals(participantId))) {
      return res.status(400).json({ message: 'User is not in this conversation' });
    }

    // Remove participant
    conversation.participants = conversation.participants.filter(
      p => !p.equals(participantId)
    );

    // Remove from unread count map
    conversation.unreadCount.delete(participantId);

    // If admin is leaving, assign new admin if there are participants left
    if (conversation.groupAdmin.equals(participantId) && conversation.participants.length > 0) {
      conversation.groupAdmin = conversation.participants[0];
    }

    // If no participants left, delete the conversation
    if (conversation.participants.length === 0) {
      await Message.deleteMany({ conversationId: id });
      await Conversation.findByIdAndDelete(id);
      return res.json({ message: 'Conversation deleted as no participants remain' });
    }

    await conversation.save();

    // Populate and return the updated conversation
    const updatedConversation = await Conversation.findById(id)
      .populate('participants', 'username profilePicture status lastSeen')
      .populate('groupAdmin', 'username')
      .populate('lastMessage');

    res.json(updatedConversation);
  } catch (error) {
    console.error('Error removing participant:', error);
    next(error);
  }
};

// @desc    Update group conversation details
// @route   PUT /api/conversations/:id
// @access  Private
const updateConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { groupName } = req.body;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if it's a group conversation
    if (!conversation.isGroup) {
      return res.status(400).json({ message: 'Cannot update non-group conversations' });
    }

    // Check if user is admin
    if (!conversation.groupAdmin.equals(userId)) {
      return res.status(403).json({ message: 'Only group admin can update group details' });
    }

    // Update group name
    if (groupName) {
      conversation.groupName = groupName;
    }

    await conversation.save();

    // Populate and return the updated conversation
    const updatedConversation = await Conversation.findById(id)
      .populate('participants', 'username profilePicture status lastSeen')
      .populate('groupAdmin', 'username')
      .populate('lastMessage');

    res.json(updatedConversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    next(error);
  }
};

// @desc    Get conversation participants
// @route   GET /api/conversations/:id/participants
// @access  Private
const getParticipants = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id)
      .populate('participants', 'username profilePicture status lastSeen bio email');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is a participant
    if (!conversation.participants.some(p => p._id.equals(userId))) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    res.json(conversation.participants);
  } catch (error) {
    console.error('Error getting participants:', error);
    next(error);
  }
};

// @desc    Mark all messages in a conversation as read
// @route   PUT /api/conversations/:id/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is a participant
    if (!conversation.participants.some(p => p.equals(userId))) {
      return res.status(403).json({ message: 'Not authorized to access this conversation' });
    }

    // Mark all messages as read for this user
    await Message.updateMany(
      { 
        conversationId: id, 
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      { 
        $push: { readBy: { user: userId, readAt: Date.now() } },
        $set: { status: 'read' }
      }
    );

    // Reset unread count for this user
    conversation.unreadCount.set(userId.toString(), 0);
    await conversation.save();

    res.json({ message: 'All messages marked as read' });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    next(error);
  }
};

module.exports = {
  getConversations,
  createConversation,
  getConversationById,
  deleteConversation,
  addParticipant,
  removeParticipant,
  updateConversation,
  getParticipants,
  markAsRead
};