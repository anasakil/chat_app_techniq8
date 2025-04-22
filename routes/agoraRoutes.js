// routes/agoraRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateAgoraToken } = require('../controllers/agoraController');

// Apply auth middleware to all routes
router.use(auth);

// Generate Agora token
router.post('/agora-token', generateAgoraToken);

module.exports = router;