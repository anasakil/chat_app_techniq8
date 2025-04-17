const Call = require('../models/Call');
const crypto = require('crypto');

// Generate a unique call ID
const generateCallId = () => {
    return crypto.randomBytes(16).toString('hex');
};

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

        // Generate a unique call ID
        const callId = generateCallId();

        // Create call log
        const callLog = await Call.create({
            caller: req.user._id,
            receiver: receiverId,
            callType,
            status,
            startTime: new Date(),
            callId: callId
        });

        // Notify the receiver about the call if they're online
        if (req.io && req.onlineUsers) {
            const receiverSocketId = req.onlineUsers.get(receiverId);
            if (receiverSocketId) {
                req.io.to(receiverSocketId).emit('incoming_call', {
                    callId: callId,
                    callerId: req.user._id,
                    callerName: req.user.username,
                    callType: callType
                });
            }
        }

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
            endTime = status === 'ended' ? new Date() : null 
        } = req.body;

        // Find and update call log by call ID field (not MongoDB _id)
        const callLog = await Call.findOne({ callId: callId });

        if (!callLog) {
            return res.status(404).json({ message: 'Call log not found' });
        }

        // Only allow updates by caller or receiver
        if (!callLog.caller.equals(req.user._id) && 
            !callLog.receiver.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to update this call log' });
        }

        callLog.status = status;
        
        if (endTime) {
            callLog.endTime = endTime;
        }

        // Calculate duration if possible and status is ended
        if (status === 'ended' && callLog.startTime) {
            callLog.duration = Math.round((callLog.endTime || new Date() - callLog.startTime) / 1000); // in seconds
        }

        await callLog.save();

        // Notify the other party about the call status change
        if (req.io && req.onlineUsers) {
            const otherUserId = callLog.caller.equals(req.user._id) ? 
                callLog.receiver.toString() : callLog.caller.toString();
            
            const otherUserSocketId = req.onlineUsers.get(otherUserId);
            
            if (otherUserSocketId) {
                req.io.to(otherUserSocketId).emit('call_status_update', {
                    callId: callId,
                    status: status,
                    updatedBy: req.user._id
                });
            }
        }

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
        const { status, type, limit = 50 } = req.query;

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
            .limit(parseInt(limit));

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

        // Find call by callId field
        const callLog = await Call.findOne({ callId: callId })
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