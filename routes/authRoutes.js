const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile, 
  logoutUser, 
  checkKeyValidity 
} = require('../controllers/authController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/check-key', checkKeyValidity); // New route for checking key validity

// Protected routes
router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, upload.single('profilePicture'), updateUserProfile);
router.post('/logout', auth, logoutUser);

module.exports = router;