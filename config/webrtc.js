// config/webrtc.js
const webrtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Optional: Add your TURN server configuration
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: process.env.TURN_USERNAME || 'username',
    //   credential: process.env.TURN_PASSWORD || 'password'
    // }
  ],
  // Optional configuration for better WebRTC performance
  iceTransportPolicy: 'all', // Can be 'relay', 'all'
  iceCandidatePoolSize: 2
};

// WebRTC signaling handler for socket.io
module.exports = (io, onlineUsers) => {
  // WebRTC signaling events
  io.on('connection', (socket) => {
    // Handle WebRTC offer
    socket.on('webrtc_offer', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        console.log(`Forwarding WebRTC offer from ${socket.userId} to ${data.receiverId}`);
        io.to(receiverSocketId).emit('webrtc_offer', {
          offer: data.offer,
          senderId: socket.userId,
          callType: data.callType
        });
      } else {
        console.log(`Receiver ${data.receiverId} is offline, cannot forward WebRTC offer`);
        socket.emit('webrtc_call_failed', {
          reason: 'user_offline',
          receiverId: data.receiverId
        });
      }
    });

    // Handle WebRTC answer
    socket.on('webrtc_answer', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        console.log(`Forwarding WebRTC answer from ${socket.userId} to ${data.receiverId}`);
        io.to(receiverSocketId).emit('webrtc_answer', {
          answer: data.answer,
          senderId: socket.userId
        });
      }
    });

    // Handle ICE candidates
    socket.on('webrtc_ice_candidate', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        console.log(`Forwarding ICE candidate from ${socket.userId} to ${data.receiverId}`);
        io.to(receiverSocketId).emit('webrtc_ice_candidate', {
          candidate: data.candidate,
          senderId: socket.userId
        });
      }
    });

    // Handle call end
    socket.on('webrtc_end_call', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        console.log(`Notifying ${data.receiverId} about call end from ${socket.userId}`);
        io.to(receiverSocketId).emit('webrtc_end_call', {
          senderId: socket.userId
        });
      }
    });
    
    // Handle call rejection
    socket.on('webrtc_reject_call', (data) => {
      const callerSocketId = onlineUsers.get(data.callerId);
      if (callerSocketId) {
        console.log(`Notifying ${data.callerId} about call rejection from ${socket.userId}`);
        io.to(callerSocketId).emit('webrtc_call_rejected', {
          receiverId: socket.userId
        });
      }
    });
  });
  
  return webrtcConfig;
};