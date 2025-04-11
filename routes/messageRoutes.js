const express = require('express');
const router = express.Router();
const {
  sendDirectMessage,
  getMessagesByUser,
  getRecentConversations,
  updateMessageStatus,
  markAllMessagesAsRead,
  getUnreadCount
} = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Direct messaging
router.post('/send', sendDirectMessage);
router.get('/user/:userId', getMessagesByUser);
router.get('/conversations', getRecentConversations);

// Message status management
router.put('/:messageId/status', updateMessageStatus);
router.put('/read-all/:userId', markAllMessagesAsRead);
router.get('/unread', getUnreadCount);

module.exports = router;