const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const userController = require('../controllers/userController');

// Public routes
router.post('/check-username', userController.checkUsernameAvailability);

// Protected routes - all routes below require authentication
router.use(auth);

// User profile and management
router.get('/me', userController.getCurrentUser);
router.put('/me', upload.single('profilePicture'), userController.updateProfile);
router.put('/update-password', userController.updatePassword);
router.put('/update-status', userController.updateStatus);

// User search and contacts
router.get('/search', userController.searchUsers);
router.get('/contacts', userController.getUserContacts);
router.post('/contacts/:userId', userController.addContact);
router.delete('/contacts/:userId', userController.removeContact);

// Blocking/unblocking users
router.post('/block/:userId', userController.blockUser);
router.delete('/block/:userId', userController.unblockUser);
router.get('/blocked', userController.getBlockedUsers);

// Online presence and activity
router.get('/online', userController.getOnlineUsers);
router.get('/:userId', userController.getUserById);
router.get('/:userId/status', userController.getUserStatus);

module.exports = router;