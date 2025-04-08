const User = require('../models/User');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// @desc    Get current logged in user data
// @route   GET /api/users/me
// @access  Private
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('contacts', 'username profilePicture status lastSeen');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting current user:', error);
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/me
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { username, email, bio } = req.body;
    const userId = req.user._id;
    
    // Check if username is already taken by another user
    if (username && username !== req.user.username) {
      const usernameExists = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }
    
    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
      const emailExists = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already taken' });
      }
    }
    
    // Prepare update object
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    
    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if it's not the default
      if (req.user.profilePicture && req.user.profilePicture !== 'default-avatar.png') {
        const oldPicturePath = path.join(__dirname, '..', req.user.profilePicture);
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }
      
      updateData.profilePicture = req.file.path.replace(/\\/g, '/');
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    next(error);
  }
};

// @desc    Update user password
// @route   PUT /api/users/update-password
// @access  Private
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    const user = await User.findById(req.user._id);
    
    // Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Check if new password meets requirements
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    next(error);
  }
};

// @desc    Update user status (online, offline, away)
// @route   PUT /api/users/update-status
// @access  Private
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    // Validate status
    if (!['online', 'offline', 'away'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        $set: { 
          status,
          lastSeen: Date.now()
        } 
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'Status updated successfully',
      status: user.status,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Error updating status:', error);
    next(error);
  }
};

// @desc    Search for users by username or email
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res, next) => {
    try {
      const { query } = req.query;
  
      // If no query is provided, return all users except the current user
      if (!query) {
        const users = await User.find({ _id: { $ne: req.user._id } })
          .select('username email profilePicture status lastSeen')
          .limit(50); // Limit the number of users returned
        return res.json(users);
      }
  
      // Get user's blocked list
      const currentUser = await User.findById(req.user._id);
      const blockedUsers = currentUser.blockedUsers || [];
  
      // Find users whose username or email contains the query string
      const users = await User.find({
        $and: [
          { _id: { $ne: req.user._id } },
          { _id: { $nin: blockedUsers } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      })
        .select('username email profilePicture status lastSeen')
        .limit(50);
  
      res.json(users);
    } catch (error) {
      console.error('Error searching users:', error);
      next(error);
    }
  };

// @desc    Get user's contacts list
// @route   GET /api/users/contacts
// @access  Private
const getUserContacts = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts', 'username email profilePicture status lastSeen');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.contacts);
  } catch (error) {
    console.error('Error getting contacts:', error);
    next(error);
  }
};

// @desc    Add a user to contacts
// @route   POST /api/users/contacts/:userId
// @access  Private
const addContact = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const contactUser = await User.findById(userId);
    if (!contactUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Can't add yourself as contact
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot add yourself as a contact' });
    }
    
    // Add to contacts if not already there
    const user = await User.findById(req.user._id);
    
    if (user.contacts.includes(userId)) {
      return res.status(400).json({ message: 'User is already in your contacts' });
    }
    
    user.contacts.push(userId);
    await user.save();
    
    // Return updated contact with details
    const updatedContact = await User.findById(userId)
      .select('username email profilePicture status lastSeen');
    
    res.status(201).json({
      message: 'Contact added successfully',
      contact: updatedContact
    });
  } catch (error) {
    console.error('Error adding contact:', error);
    next(error);
  }
};

// @desc    Remove a user from contacts
// @route   DELETE /api/users/contacts/:userId
// @access  Private
const removeContact = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is in contacts
    if (!user.contacts.includes(userId)) {
      return res.status(400).json({ message: 'User is not in your contacts' });
    }
    
    // Remove from contacts
    user.contacts = user.contacts.filter(
      contactId => contactId.toString() !== userId
    );
    
    await user.save();
    
    res.json({ message: 'Contact removed successfully' });
  } catch (error) {
    console.error('Error removing contact:', error);
    next(error);
  }
};

// @desc    Block a user
// @route   POST /api/users/block/:userId
// @access  Private
const blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Can't block yourself
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }
    
    const user = await User.findById(req.user._id);
    
    // Initialize blockedUsers array if it doesn't exist
    if (!user.blockedUsers) {
      user.blockedUsers = [];
    }
    
    // Check if user is already blocked
    if (user.blockedUsers.includes(userId)) {
      return res.status(400).json({ message: 'User is already blocked' });
    }
    
    // Add to blocked users
    user.blockedUsers.push(userId);
    
    // Also remove from contacts if exists
    if (user.contacts.includes(userId)) {
      user.contacts = user.contacts.filter(
        contactId => contactId.toString() !== userId
      );
    }
    
    await user.save();
    
    res.status(200).json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Error blocking user:', error);
    next(error);
  }
};

// @desc    Unblock a user
// @route   DELETE /api/users/block/:userId
// @access  Private
const unblockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    // Check if blockedUsers exists and user is blocked
    if (!user.blockedUsers || !user.blockedUsers.includes(userId)) {
      return res.status(400).json({ message: 'User is not blocked' });
    }
    
    // Remove from blocked users
    user.blockedUsers = user.blockedUsers.filter(
      blockedId => blockedId.toString() !== userId
    );
    
    await user.save();
    
    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    next(error);
  }
};

// @desc    Get blocked users list
// @route   GET /api/users/blocked
// @access  Private
const getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('blockedUsers', 'username email profilePicture');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.blockedUsers || []);
  } catch (error) {
    console.error('Error getting blocked users:', error);
    next(error);
  }
};

// @desc    Get online users from contacts
// @route   GET /api/users/online
// @access  Private
const getOnlineUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get online users from contacts list
    const onlineContacts = await User.find({
      _id: { $in: user.contacts },
      status: 'online'
    }).select('username profilePicture lastSeen');
    
    res.json(onlineContacts);
  } catch (error) {
    console.error('Error getting online users:', error);
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:userId
// @access  Private
const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('username email profilePicture bio status lastSeen');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is blocked
    const currentUser = await User.findById(req.user._id);
    if (currentUser.blockedUsers && currentUser.blockedUsers.includes(userId)) {
      return res.status(403).json({ message: 'User is blocked' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    next(error);
  }
};

// @desc    Get user status
// @route   GET /api/users/:userId/status
// @access  Private
const getUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('status lastSeen');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      status: user.status,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    next(error);
  }
};

// @desc    Check if username is available
// @route   POST /api/users/check-username
// @access  Public
const checkUsernameAvailability = async (req, res, next) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const user = await User.findOne({ username });
    
    res.json({ 
      available: !user,
      username
    });
  } catch (error) {
    console.error('Error checking username availability:', error);
    next(error);
  }
};

module.exports = {
  getCurrentUser,
  updateProfile,
  updatePassword,
  updateStatus,
  searchUsers,
  getUserContacts,
  addContact,
  removeContact,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getOnlineUsers,
  getUserById,
  getUserStatus,
  checkUsernameAvailability
};