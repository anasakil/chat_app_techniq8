const express = require('express');
const router = express.Router();
const {
  getConversations,
  createConversation,
  getConversationById,
  deleteConversation,
  addParticipant,
  removeParticipant,
  updateConversation,
  getParticipants,
  markAsRead
} = require('../controllers/conversationController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Core conversation functionality
router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);
router.put('/:id', updateConversation);

// Participant management
router.get('/:id/participants', getParticipants);
router.post('/:id/participants', addParticipant);
router.delete('/:id/participants/:participantId', removeParticipant);

// Mark as read functionality
router.put('/:id/read', markAsRead);

module.exports = router;