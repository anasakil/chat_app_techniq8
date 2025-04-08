// config/socket.js
module.exports = (io) => {
    // Track online users - map userId to socketId
    const onlineUsers = new Map();
  
    // Debug: Log active connections every 30 seconds
    setInterval(() => {
      console.log(`Active connections: ${onlineUsers.size}`);
      console.log('Connected users:', Array.from(onlineUsers.entries()));
    }, 30000);
  
    io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);
      
      // Extract user ID from token if possible
      try {
        const token = socket.handshake.query.token;
        if (token) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.userId = decoded.id;
          console.log(`User ID from token: ${socket.userId}`);
        }
      } catch (error) {
        console.error('Error extracting user ID from token:', error);
      }
      
      // User authentication and status
      socket.on('user_connected', (userId) => {
        console.log(`User ${userId} connected with socket ${socket.id}`);
        
        // Store userId -> socketId mapping
        onlineUsers.set(userId, socket.id);
        
        // Store userId in socket object for later use
        socket.userId = userId;
        
        // Broadcast user's online status to all clients
        io.emit('user_status', { userId, status: 'online' });
      });
  
      // Private messaging
      socket.on('send_message', (data) => {
        console.log('Received send_message event:', data);
        const { receiverId, message, messageId } = data;
        const senderId = socket.userId || data.senderId;
        
        if (!receiverId || !message) {
          console.error('Missing receiverId or message in send_message event');
          return;
        }
        
        console.log(`Attempting to deliver message from ${senderId} to ${receiverId}`);
        
        // Get receiver's socket ID
        const receiverSocketId = onlineUsers.get(receiverId);
        
        if (receiverSocketId) {
          console.log(`Receiver ${receiverId} is online (socket: ${receiverSocketId}), delivering message`);
          
          // Send to receiver
          io.to(receiverSocketId).emit('new_message', {
            _id: messageId,
            sender: senderId,
            content: message,
            contentType: 'text',
            createdAt: new Date().toISOString(),
            status: 'delivered'
          });
          
          // Confirm delivery to sender
          socket.emit('message_delivered', {
            messageId,
            receiverId
          });
        } else {
          console.log(`Receiver ${receiverId} is offline, cannot deliver message in real-time`);
        }
      });
  
      // Message status updates
      socket.on('message_read', (data) => {
        console.log('Received message_read event:', data);
        const { messageId, senderId } = data;
        
        // Get sender's socket ID
        const senderSocketId = onlineUsers.get(senderId);
        
        if (senderSocketId) {
          console.log(`Notifying sender ${senderId} that message ${messageId} was read`);
          io.to(senderSocketId).emit('message_status_update', {
            messageId,
            status: 'read'
          });
        }
      });
  
      // Typing indicators
      socket.on('typing', (data) => {
        console.log('Received typing event:', data);
        const { receiverId } = data;
        const senderId = socket.userId || data.senderId;
        
        if (!receiverId) return;
        
        const receiverSocketId = onlineUsers.get(receiverId);
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('user_typing', { 
            senderId 
          });
        }
      });
  
      // Disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // If we have the userId stored on the socket
        if (socket.userId) {
          console.log(`User ${socket.userId} disconnected`);
          onlineUsers.delete(socket.userId);
          io.emit('user_status', { userId: socket.userId, status: 'offline' });
        } else {
          // Find by socket ID if we don't have the userId on the socket
          for (const [userId, sid] of onlineUsers.entries()) {
            if (sid === socket.id) {
              console.log(`User ${userId} disconnected`);
              onlineUsers.delete(userId);
              io.emit('user_status', { userId, status: 'offline' });
              break;
            }
          }
        }
      });
    });
  };