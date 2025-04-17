const User = require('../models/User');
const validKeys = require('../utils/validKeys');

// @desc    Get status of all registration keys
// @route   GET /api/keys/status
// @access  Admin
const getKeyStatus = async (req, res, next) => {
  try {
    // Find all users that have registered with a key
    const registeredUsers = await User.find({ key: { $in: validKeys } })
      .select('username email key createdAt');
    
    // Create a map of used keys
    const usedKeys = {};
    registeredUsers.forEach(user => {
      usedKeys[user.key] = {
        usedBy: {
          _id: user._id,
          username: user.username,
          email: user.email
        },
        registeredAt: user.createdAt
      };
    });
    
    // Create the full key status list
    const keyStatus = validKeys.map(key => {
      if (usedKeys[key]) {
        return {
          key,
          isUsed: true,
          ...usedKeys[key]
        };
      } else {
        return {
          key,
          isUsed: false,
          usedBy: null,
          registeredAt: null
        };
      }
    });
    
    // Stats
    const stats = {
      totalKeys: validKeys.length,
      usedKeys: Object.keys(usedKeys).length,
      availableKeys: validKeys.length - Object.keys(usedKeys).length
    };
    
    res.json({
      keys: keyStatus,
      stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKeyStatus
};