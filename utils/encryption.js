const crypto = require('crypto');

// Generate an encryption key from the secret
const getEncryptionKey = (secret) => {
  return crypto.scryptSync(secret, 'salt', 32);
};

// Encrypt a message
const encryptMessage = (text, secret) => {
  const key = getEncryptionKey(secret);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    content: encrypted
  };
};

// Decrypt a message
const decryptMessage = (encrypted, secret) => {
  const key = getEncryptionKey(secret);
  const iv = Buffer.from(encrypted.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

module.exports = {
  encryptMessage,
  decryptMessage
};