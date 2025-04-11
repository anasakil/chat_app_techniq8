// config/socket.js
const crypto = require('crypto');

// Enhanced encryption/decryption functions directly in socket.js
const encryption = (text, secret) => {
  try {
    // Generate a random initialization vector for each encryption
    const iv = crypto.randomBytes(16);
    
    // Create a cipher using AES-256-CBC algorithm with the provided secret
    const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return both the IV and encrypted content as a JSON string
    const result = JSON.stringify({
      iv: iv.toString('hex'),
      content: encrypted,
      timestamp: Date.now()
    });
    
    console.log('Message encrypted successfully');
    return Buffer.from(result).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to a simple encryption if the advanced one fails
    return fallbackEncryption(text, secret);
  }
};

const decryption = (encryptedText, secret) => {
  try {
    // Decode the base64 string
    const jsonStr = Buffer.from(encryptedText, 'base64').toString();
    const encryptedData = JSON.parse(jsonStr);
    
    // Extract the IV and content
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const encryptedContent = encryptedData.content;
    
    // Create a decipher using AES-256-CBC algorithm
    const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypt the content
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log('Message decrypted successfully');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    // Fallback to a simple decryption if the advanced one fails
    return fallbackDecryption(encryptedText, secret);
  }
};

// Fallback simple encryption/decryption using XOR (for compatibility)
const fallbackEncryption = (text, secret) => {
  console.log('Using fallback encryption');
  // Create a simple encryption using a basic XOR cipher
  const secretBuffer = Buffer.from(secret.repeat(Math.ceil(text.length / secret.length)).slice(0, text.length));
  const textBuffer = Buffer.from(text);
  const result = Buffer.alloc(textBuffer.length);
  
  for (let i = 0; i < textBuffer.length; i++) {
    result[i] = textBuffer[i] ^ secretBuffer[i % secretBuffer.length];
  }
  
  return 'fallback:' + result.toString('base64');
};

const fallbackDecryption = (encryptedText, secret) => {
  console.log('Using fallback decryption');
  // Check if it's fallback encrypted
  if (encryptedText.startsWith('fallback:')) {
    encryptedText = encryptedText.substring(9); // Remove 'fallback:'
  }
  
  // Decrypt using the same XOR cipher
  const encryptedBuffer = Buffer.from(encryptedText, 'base64');
  const secretBuffer = Buffer.from(secret.repeat(Math.ceil(encryptedBuffer.length / secret.length)).slice(0, encryptedBuffer.length));
  const result = Buffer.alloc(encryptedBuffer.length);
  
  for (let i = 0; i < encryptedBuffer.length; i++) {
    result[i] = encryptedBuffer[i] ^ secretBuffer[i % secretBuffer.length];
  }
  
  return result.toString();
};

// Function to generate a more secure encryption key
const generateSecureKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = (io) => {
  // Track online users - map userId to socketId
  const onlineUsers = new Map();
  
  // Store ephemeral messages in memory (they won't persist after server restart)
  // This is just to handle offline message delivery for users who reconnect
  const pendingMessages = new Map();
  
  // In-memory conversation tracking (just to help with UI/UX, not for persistence)
  const userConversations = new Map();
  
  // Generate a simple secret key (should be moved to environment variables in production)
  const ENCRYPTION_SECRET = process.env.SOCKET_ENCRYPTION_SECRET || generateSecureKey();
  console.log('Using encryption secret for this session');
  
  // Debug: Log active connections every 30 seconds
  setInterval(() => {
    console.log(`Active connections: ${onlineUsers.size}`);
    console.log('Connected users:', Array.from(onlineUsers.entries()));
  }, 1000);
  
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
        
        // Auto-register user as online when they connect with a valid token
        if (socket.userId) {
          onlineUsers.set(socket.userId, socket.id);
          io.emit('user_status', { userId: socket.userId, status: 'online' });
          
          // Deliver any pending messages
          if (pendingMessages.has(socket.userId)) {
            const messages = pendingMessages.get(socket.userId);
            console.log(`Delivering ${messages.length} pending messages to user ${socket.userId}`);
            messages.forEach(msg => {
              socket.emit('new_message', msg);
            });
            // Clear pending messages
            pendingMessages.delete(socket.userId);
          }
        }
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
      
      // Send current user the status of all online users
      for (const [onlineUserId, socketId] of onlineUsers.entries()) {
        if (onlineUserId !== userId) {
          socket.emit('user_status', { userId: onlineUserId, status: 'online' });
        }
      }
      
      // Deliver any pending messages
      if (pendingMessages.has(userId)) {
        const messages = pendingMessages.get(userId);
        console.log(`Delivering ${messages.length} pending messages to user ${userId}`);
        messages.forEach(msg => {
          socket.emit('new_message', msg);
        });
        // Clear pending messages after delivery
        pendingMessages.delete(userId);
      }
    });
    
    // Real-time messaging with ephemeral messages (no database storage)
    socket.on('send_message', (data) => {
      console.log('Received send_message event:', data);
      
      const { receiverId, message, messageId } = data;
      const senderId = socket.userId || data.senderId;
      
      if (!receiverId || !message) {
        console.error('Missing receiverId or message in send_message event');
        return;
      }
      
      console.log(`Attempting to deliver message from ${senderId} to ${receiverId}`);
      
      // Encrypt the message content
      console.log('Encrypting message content');
      const encryptedContent = encryption(message, ENCRYPTION_SECRET);
      
      // Create message object
      const messageObj = {
        _id: messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        sender: senderId,
        receiver: receiverId,
        content: encryptedContent, // Store encrypted in the object
        rawContent: message, // Keep raw content for convenience (could be removed for extra security)
        contentType: 'text',
        createdAt: new Date().toISOString(),
        status: 'sent',
        encrypted: true
      };
      
      // Update conversation tracking for UI (optional, just helps with conversation list)
      updateConversationTracking(senderId, receiverId, messageObj);
      
      // Get receiver's socket ID
      const receiverSocketId = onlineUsers.get(receiverId);
      
      if (receiverSocketId) {
        console.log(`Receiver ${receiverId} is online (socket: ${receiverSocketId}), delivering message`);
        
        // Create a message copy for the receiver with decrypted content
        const messageForReceiver = {
          ...messageObj,
          content: message, // Send decrypted message to receiver
          status: 'delivered'
        };
        
        // Send to receiver
        io.to(receiverSocketId).emit('new_message', messageForReceiver);
        
        // Confirm delivery to sender
        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_delivered', {
            messageId: messageObj._id,
            status: 'delivered'
          });
        }
      } else {
        console.log(`Receiver ${receiverId} is offline, storing message for later delivery`);
        
        // Store message for later delivery when user comes online
        if (!pendingMessages.has(receiverId)) {
          pendingMessages.set(receiverId, []);
        }
        
        // Store message for later delivery
        const storedMessage = {
          ...messageObj,
          content: message, // Store decrypted for simplicity and immediate delivery when user connects
          status: 'pending'
        };
        
        pendingMessages.get(receiverId).push(storedMessage);
        console.log(`Added message to pending queue for user ${receiverId}`);
        
        // Notify sender that message is pending
        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_pending', {
            messageId: messageObj._id,
            status: 'pending'
          });
        }
      }
    });
    
    // Request conversation history (will only return what's in memory)
    socket.on('get_conversation', (data) => {
      const { userId, otherUserId } = data;
      
      console.log(`User ${userId} requested conversation with ${otherUserId}`);
      
      // Check if we have any tracked messages for this conversation
      const conversationKey = getConversationKey(userId, otherUserId);
      const conversation = userConversations.get(conversationKey) || [];
      
      // Send the in-memory conversation history to the user
      socket.emit('conversation_history', {
        userId: otherUserId,
        messages: conversation.map(msg => ({
          ...msg,
          content: msg.rawContent || msg.content // Send decrypted content
        }))
      });
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
      
      // Update message status in memory if we're tracking it
      updateMessageStatus(messageId, 'read');
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

  // Helper function to update in-memory conversation tracking
  function updateConversationTracking(senderId, receiverId, message) {
    const conversationKey = getConversationKey(senderId, receiverId);
    
    if (!userConversations.has(conversationKey)) {
      userConversations.set(conversationKey, []);
    }
    
    // Add message to conversation history (limited to last 100 messages)
    const conversation = userConversations.get(conversationKey);
    conversation.push(message);
    
    // Keep only last 100 messages (to prevent memory issues)
    if (conversation.length > 100) {
      userConversations.set(conversationKey, conversation.slice(-100));
    }
  }
  
  // Helper function to get a consistent conversation key regardless of user order
  function getConversationKey(userId1, userId2) {
    return [userId1, userId2].sort().join(':');
  }
  
  // Helper function to update message status in memory
  function updateMessageStatus(messageId, status) {
    // Iterate through all conversations
    for (const [key, messages] of userConversations.entries()) {
      // Find message by ID
      const message = messages.find(msg => msg._id === messageId);
      if (message) {
        message.status = status;
        break;
      }
    }
  }
};