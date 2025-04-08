const express = require('express');
const router = express.Router();
const {
  sendDirectMessage,
  getMessagesByUser,
  getRecentConversations,
  deleteMessage,
  getUnreadCount,
  searchMessages
} = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Direct messaging
router.post('/send', sendDirectMessage);
router.get('/user/:userId', getMessagesByUser);
router.get('/conversations', getRecentConversations);

// Message management
router.delete('/:messageId', deleteMessage);
router.get('/unread', getUnreadCount);
router.get('/search', searchMessages);

module.exports = router;