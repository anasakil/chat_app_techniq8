const errorHandler = (err, req, res, next) => {
    console.error(`ERROR: ${err.message}`);
    
    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 25MB'
      });
    }
    
    // Mongoose duplicate key
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Duplicate field value entered'
      });
    }
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        message: messages.join(', ')
      });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token'
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired'
      });
    }
    
    // Default to 500 server error
    res.status(err.statusCode || 500).json({
      message: err.message || 'Server Error'
    });
  };
  
  module.exports = errorHandler;