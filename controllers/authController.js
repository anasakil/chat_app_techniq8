// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Get valid keys from environment variable
const validKeys = process.env.REGISTRATION_KEYS.split(',');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { username, email, password, key } = req.body;
    
    // Check if keys are configured
    if (validKeys.length === 0) {
      return res.status(500).json({ message: 'Registration keys not configured on server' });
    }
    
    // Check if key is provided
    if (!key) {
      return res.status(400).json({ message: 'Registration key is required' });
    }
    
    // Validate the key format
    if (!/^\d{10}$/.test(key)) {
      return res.status(400).json({ message: 'Invalid key format. Key must be exactly 10 digits.' });
    }
    
    // Check if the key is in our predefined list
    if (!validKeys.includes(key)) {
      return res.status(400).json({ message: 'Invalid registration key' });
    }
    
    // Check if the key has already been used
    const keyExists = await User.findOne({ key });
    if (keyExists) {
      return res.status(400).json({ message: 'This registration key has already been used' });
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      key
    });
    
    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
      // Update user status
      user.status = 'online';
      user.lastSeen = Date.now();
      await user.save();
      
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        status: user.status,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user) {
      user.username = req.body.username || user.username;
      user.email = req.body.email || user.email;
      user.bio = req.body.bio || user.bio;
      
      if (req.body.password) {
        user.password = req.body.password;
      }
      
      if (req.file) {
        user.profilePicture = req.file.path.replace(/\\/g, '/');
      }
      
      const updatedUser = await user.save();
      
      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        bio: updatedUser.bio,
        profilePicture: updatedUser.profilePicture,
        token: generateToken(updatedUser._id)
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user) {
      user.status = 'offline';
      user.lastSeen = Date.now();
      await user.save();
      
      res.json({ message: 'Logged out successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Check if a key is valid
// @route   POST /api/auth/check-key
// @access  Public
const checkKeyValidity = async (req, res, next) => {
  try {
    // Check if keys are configured
    if (validKeys.length === 0) {
      return res.status(500).json({ message: 'Registration keys not configured on server' });
    }
    
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ message: 'Key is required' });
    }
    
    // Check format
    if (!/^\d{10}$/.test(key)) {
      return res.status(200).json({ 
        valid: false,
        message: 'Invalid key format. Key must be exactly 10 digits.'
      });
    }
    
    // Check if in valid keys list
    if (!validKeys.includes(key)) {
      return res.status(200).json({ 
        valid: false,
        message: 'This key is not valid'
      });
    }
    
    // Check if already used
    const keyUsed = await User.findOne({ key });
    
    if (keyUsed) {
      return res.status(200).json({ 
        valid: false,
        message: 'This key has already been used for registration'
      });
    }
    
    // Key is valid and unused
    res.status(200).json({
      valid: true,
      message: 'Key is valid and available for registration'
    });
  } catch (error) {
    next(error);
  }
};

// Make sure to properly export all functions
module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  checkKeyValidity
};