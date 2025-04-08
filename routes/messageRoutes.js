const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  updateMessageStatus,
  deleteMessage,
  getUnreadCount,
  searchMessages,
  forwardMessage,
  reactToMessage,
  removeReaction
} = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Message core functionality
router.post('/', sendMessage);
router.get('/:conversationId', getMessages);
router.put('/:messageId/status', updateMessageStatus);
router.delete('/:messageId', deleteMessage);

// Additional message features
router.get('/unread', getUnreadCount);
router.get('/:conversationId/search', searchMessages);
router.post('/:messageId/forward', forwardMessage);

// Reactions
router.post('/:messageId/react', reactToMessage);
router.delete('/:messageId/react', removeReaction);

module.exports = router;