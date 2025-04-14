const fs = require('fs');
const path = require('path');

// Ensure the storage directory exists
const QUEUE_DIR = path.join(__dirname, '../data/message_queue');
if (!fs.existsSync(QUEUE_DIR)) {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

// Helper function to get file path for a user's message queue
const getQueueFilePath = (userId) => {
  return path.join(QUEUE_DIR, `${userId}.json`);
};

// File-based message queue functions
const messageQueue = {
  // Add message to queue for offline user
  addMessageToQueue(userId, message) {
    try {
      const filePath = getQueueFilePath(userId);
      let messages = [];
      
      // Read existing messages if file exists
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        messages = JSON.parse(data);
      }
      
      // Add new message with timestamp
      messages.push({
        ...message,
        queuedAt: new Date().toISOString()
      });
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
      console.log(`Message queued for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error adding message to queue:', error);
      return false;
    }
  },

  // Get all queued messages for a user
  getQueuedMessages(userId) {
    try {
      const filePath = getQueueFilePath(userId);
      
      if (!fs.existsSync(filePath)) {
        return [];
      }
      
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error getting queued messages:', error);
      return [];
    }
  },

  // Clear message queue after delivery
  clearMessageQueue(userId) {
    try {
      const filePath = getQueueFilePath(userId);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Message queue cleared for user ${userId}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing message queue:', error);
      return false;
    }
  }
};

module.exports = messageQueue;