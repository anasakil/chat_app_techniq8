const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const path = require('path');
const fs = require('fs');

// @desc    Upload a file
// @route   POST /api/files/upload
// @access  Private
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { conversationId } = req.body;
    
    // Check if conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      // Delete uploaded file if conversation doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user is part of the conversation
    if (!conversation.participants.includes(req.user._id)) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Not authorized to send files to this conversation' });
    }
    
    // Determine content type based on mimetype
    let contentType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      contentType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      contentType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      contentType = 'audio';
    }
    
    // Create a new message with the file
    const newMessage = await Message.create({
      conversationId,
      sender: req.user._id,
      content: req.body.message || 'Sent a file',
      contentType,
      fileUrl: req.file.path.replace(/\\/g, '/'),
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
    
    // Update conversation with last message
    conversation.lastMessage = newMessage._id;
    
    // Update unread count for all participants except sender
    conversation.participants.forEach(participant => {
      if (!participant.equals(req.user._id)) {
        const currentCount = conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });
    
    await conversation.save();
    
    // Populate sender data
    await newMessage.populate('sender', 'username profilePicture');
    
    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

// @desc    Download a file
// @route   GET /api/files/:messageId
// @access  Private
const downloadFile = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message || !message.fileUrl) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user is part of the conversation
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to access this file' });
    }
    
    const filePath = path.join(__dirname, '..', message.fileUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${message.fileName}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a file
// @route   DELETE /api/files/:messageId
// @access  Private
const deleteFile = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message || !message.fileUrl) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Check if user is the sender of the message
    if (!message.sender.equals(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this file' });
    }
    
    const filePath = path.join(__dirname, '..', message.fileUrl);
    
    // Delete file from filesystem if exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Update message (mark as deleted but keep record)
    message.fileUrl = null;
    message.content = 'This file was deleted';
    await message.save();
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  downloadFile,
  deleteFile
};
