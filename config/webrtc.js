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
module.exports = (io) => {
  // WebRTC signaling events
  io.on('connection', (socket) => {
    // Handle WebRTC offer
    socket.on('webrtc_offer', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_offer', {
          offer: data.offer,
          senderId: socket.userId,
          callType: data.callType
        });
      }
    });

    // Handle WebRTC answer
    socket.on('webrtc_answer', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_answer', {
          answer: data.answer
        });
      }
    });

    // Handle ICE candidates
    socket.on('webrtc_ice_candidate', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_ice_candidate', {
          candidate: data.candidate
        });
      }
    });

    // Handle call end
    socket.on('webrtc_end_call', (data) => {
      const receiverSocketId = onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('webrtc_end_call');
      }
    });
  });
};

// Export WebRTC configuration
module.exports.config = webrtcConfig;