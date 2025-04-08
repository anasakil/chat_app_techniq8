module.exports = (io) => {
    // Track online users
    const onlineUsers = new Map();
  
    io.on('connection', (socket) => {
      console.log('New client connected', socket.id);
      
      // User authentication and status
      socket.on('user_connected', (userId) => {
        onlineUsers.set(userId, socket.id);
        io.emit('user_status', { userId, status: 'online' });
        console.log(`User ${userId} is online`);
      });
  
      // Private messaging
      socket.on('private_message', async (data) => {
        const { receiverId, message, conversationId } = data;
        const receiverSocketId = onlineUsers.get(receiverId);
        
        // Save message to database (implement this with messageController)
        
        // Send to receiver if online
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new_message', {
            ...data,
            status: 'delivered'
          });
        }
      });
  
      // Message status updates
      socket.on('message_read', (data) => {
        const { messageId, senderId } = data;
        const senderSocketId = onlineUsers.get(senderId);
        
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_status_update', {
            messageId,
            status: 'read',
          });
        }
      });
  
      // WebRTC signaling
      socket.on('call_request', (data) => {
        const { receiverId, callerId, callerName, callType } = data;
        const receiverSocketId = onlineUsers.get(receiverId);
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('incoming_call', {
            callerId,
            callerName,
            callType
          });
        } else {
          socket.emit('call_failed', { reason: 'User is offline' });
        }
      });
  
      socket.on('call_answer', (data) => {
        const { callerId, answer } = data;
        const callerSocketId = onlineUsers.get(callerId);
        
        if (callerSocketId) {
          io.to(callerSocketId).emit('call_response', { answer });
        }
      });
  
      socket.on('webrtc_signal', (data) => {
        const { userId, signal } = data;
        const userSocketId = onlineUsers.get(userId);
        
        if (userSocketId) {
          io.to(userSocketId).emit('webrtc_signal', { signal, from: socket.id });
        }
      });
  
      // Disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
        
        // Find and remove user from online users
        for (const [userId, sid] of onlineUsers.entries()) {
          if (sid === socket.id) {
            onlineUsers.delete(userId);
            io.emit('user_status', { userId, status: 'offline' });
            break;
          }
        }
      });
    });
  };
  