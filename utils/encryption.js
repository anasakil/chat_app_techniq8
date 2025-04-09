const crypto = require('crypto');

// Secure key derivation function
const getEncryptionKey = (secret) => {
  return crypto.scryptSync(
    secret, 
    process.env.ENCRYPTION_SALT || 'default_secure_salt', 
    32, 
    { N: 16384, r: 8, p: 1 }
  );
};

// Encrypt a message with enhanced security
const encryptMessage = (text, secret) => {
  try {
    if (!text || !secret) {
      throw new Error('Text and secret are required for encryption');
    }

    const key = getEncryptionKey(secret);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      content: encrypted,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Message encryption failed');
  }
};

// Decrypt a message with comprehensive error handling
const decryptMessage = (encrypted, secret) => {
  try {
    if (!encrypted || !encrypted.iv || !encrypted.content || !secret) {
      throw new Error('Invalid encryption data or missing secret');
    }

    const key = getEncryptionKey(secret);
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    
    if (error.message.includes('bad decrypt')) {
      throw new Error('Decryption failed: Possible key mismatch');
    }
    
    throw new Error('Message decryption failed');
  }
};

// Generate a cryptographically secure random key
const generateSecureKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate message integrity
const validateMessageIntegrity = (message, secret) => {
  try {
    // Attempt to decrypt to validate
    decryptMessage(message, secret);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  encryptMessage,
  decryptMessage,
  generateSecureKey,
  validateMessageIntegrity
};