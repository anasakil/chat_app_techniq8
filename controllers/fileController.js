// controllers/fileController.js
const User = require('../models/User');
const Message = require('../models/Message');
const path = require('path');
const fs = require('fs');
 
// @desc    Upload a file in direct message
// @route   POST /api/files/upload-direct
// @access  Private
const uploadDirectFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { receiverId, message } = req.body;

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            fs.unlinkSync(req.file.path); // Delete uploaded file if receiver doesn't exist
            return res.status(404).json({ message: 'Receiver not found' });
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
            sender: req.user._id,
            receiver: receiverId,
            content: message || `Sent a ${contentType}`,
            contentType,
            fileUrl: req.file.path.replace(/\\/g, '/'),
            fileName: req.file.originalname,
            fileSize: req.file.size
        });

        // Populate sender and receiver data
        await newMessage.populate('sender', 'username profilePicture');
        await newMessage.populate('receiver', 'username profilePicture');

        res.status(201).json(newMessage);
    } catch (error) {
        next(error);
    }
};
 
// Keep your existing functions for download and delete
const downloadFile = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message || !message.fileUrl) {
      return res.status(404).json({ message: 'File not found' });
    }
    // Check if user is either the sender or receiver
    if (!message.sender.equals(req.user._id) && !message.receiver.equals(req.user._id)) {
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
  uploadDirectFile,
  downloadFile,
  deleteFile
};