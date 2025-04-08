const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, updateUserProfile, logoutUser } = require('../controllers/authController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, upload.single('profilePicture'), updateUserProfile);
router.post('/logout', auth, logoutUser);

module.exports = router;