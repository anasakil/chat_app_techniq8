const mongoose = require('mongoose');

const CallSchema = new mongoose.Schema({
    caller: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    callType: { 
        type: String, 
        enum: ['audio', 'video'], 
        default: 'audio' 
    },
    status: { 
        type: String, 
        enum: ['initiated', 'connecting', 'connected', 'missed', 'rejected', 'ended'], 
        default: 'initiated' 
    },
    startTime: { 
        type: Date, 
        default: null 
    },
    endTime: { 
        type: Date, 
        default: null 
    },
    duration: { 
        type: Number, 
        default: 0 
    },
    callId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    isGroupCall: { 
        type: Boolean, 
        default: false 
    },
    participants: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    groupName: { 
        type: String, 
        default: null 
    },
    groupAdmin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    groupPhoto: { 
        type: String, 
        default: null 
    },
    description: { 
        type: String, 
        default: '', 
        maxlength: 200 
    }
}, {
    timestamps: true
});

