const webrtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: process.env.TURN_USERNAME || 'username',
        credential: process.env.TURN_PASSWORD || 'password'
      }
    ]
  };
  
  module.exports = webrtcConfig;