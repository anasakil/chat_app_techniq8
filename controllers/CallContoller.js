const Call = require('../models/Call');

// @desc    Create a new call log
// @route   POST /api/calls
// @access  Private
const createCallLog = async (req, res, next) => {
    try {
        const { 
            receiverId, 
            callType, 
            status = 'initiated' 
        } = req.body;

        // Create call log
        const callLog = await Call.create({
            caller: req.user._id,
            receiver: receiverId,
            callType,
            status,
            startTime: new Date()
        });

        res.status(201).json(callLog);
    } catch (error) {
        console.error('Error creating call log:', error);
        next(error);
    }
};

// @desc    Update call log status
// @route   PUT /api/calls/:callId
// @access  Private
const updateCallLog = async (req, res, next) => {
    try {
        const { callId } = req.params;
        const { 
            status, 
            endTime = new Date() 
        } = req.body;

        // Find and update call log
        const callLog = await Call.findById(callId);

        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Only allow updates by caller or receiver
        if (!callLog.caller.equals(req.user._id) && 
            !callLog.receiver.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to update this call log' });
        }

        callLog.status = status;
        callLog.endTime = endTime;

        // Calculate duration if possible
        if (callLog.startTime && callLog.endTime) {
            callLog.duration = (callLog.endTime - callLog.startTime) / 1000; // in seconds
        }

        await callLog.save();

        res.json(callLog);
    } catch (error) {
        console.error('Error updating call log:', error);
        next(error);
    }
};

// @desc    Get user's call logs
// @route   GET /api/calls
// @access  Private
const getUserCallLogs = async (req, res, next) => {
    try {
        const { status, type } = req.query;

        // Build query
        const query = {
            $or: [
                { caller: req.user._id },
                { receiver: req.user._id }
            ]
        };

        // Optional status filter
        if (status) {
            query.status = status;
        }

        // Optional call type filter
        if (type) {
            query.callType = type;
        }

        // Get call logs and populate user details
        const callLogs = await Call.find(query)
            .populate('caller', 'username profilePicture')
            .populate('receiver', 'username profilePicture')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(callLogs);
    } catch (error) {
        console.error('Error fetching call logs:', error);
        next(error);
    }
};

// @desc    Get specific call log
// @route   GET /api/calls/:callId
// @access  Private
const getCallLogById = async (req, res, next) => {
    try {
        const { callId } = req.params;

        const callLog = await Call.findById(callId)
            .populate('caller', 'username profilePicture')
            .populate('receiver', 'username profilePicture');

        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Ensure user is either caller or receiver
        if (!callLog.caller._id.equals(req.user._id) && 
            !callLog.receiver._id.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to view this call log' });
        }

        res.json(callLog);
    } catch (error) {
        console.error('Error fetching call log:', error);
        next(error);
    }
};

module.exports = {
    createCallLog,
    updateCallLog,
    getUserCallLogs,
    getCallLogById
};