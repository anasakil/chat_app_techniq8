const express = require('express');
const router = express.Router();
const { getKeyStatus } = require('../controllers/keyStatusController');
const auth = require('../middleware/auth');

// Admin middleware (simplified version)
const isAdmin = (req, res, next) => {
  // Implementation depends on how you store admin status
  // For simplicity, we'll check for a specific user ID (you should modify this)
  if (req.user && req.user._id.toString() === process.env.ADMIN_USER_ID) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin only' });
  }
};

// Protected admin route to get key status
router.get('/status', auth, isAdmin, getKeyStatus);

module.exports = router;