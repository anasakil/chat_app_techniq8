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
    enum: ['initiated', 'ringing', 'connected', 'missed', 'rejected', 'ended'],
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Call', CallSchema);