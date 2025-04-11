const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    createCallLog,
    updateCallLog,
    getUserCallLogs,
    getCallLogById
} = require('../controllers/CallContoller');

// Apply auth middleware to all routes
router.use(auth);

// Create a new call log
router.post('/', createCallLog);

// Update an existing call log
router.put('/:callId', updateCallLog);

// Get user's call logs
router.get('/', getUserCallLogs);

// Get specific call log
router.get('/:callId', getCallLogById);

module.exports = router;