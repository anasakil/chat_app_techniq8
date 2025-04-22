const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIO = require('socket.io');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();
 
// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const fileRoutes = require('./routes/fileRoutes');
const callRoutes = require('./routes/callRoutes');
const keyStatusRoutes = require('./routes/keyStatusRoutes');
const agoraRoutes = require('./routes/agoraRoutes'); // Added Agora routes
 
// Initialize Express
const app = express();
const server = http.createServer(app);
 
// Configure CORS for Express
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
 
// Configure Socket.io with CORS
const io = socketIO(server, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
    credentials: true
  }
});
 
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
 
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));
 
// Socket.io setup
const socketHandler = require('./config/socket')(io);

// Middleware to make socket available in routes
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = socketHandler.onlineUsers;
  next();
});
 
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/keys', keyStatusRoutes);
app.use('/api/calls', agoraRoutes); // Added Agora routes
 
// Default route
app.get('/', (req, res) => {
  res.send('API is running...');
});
 
// Error handling middleware
app.use(errorHandler);
 
// Start server
const PORT = process.env.PORT || 4400;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});