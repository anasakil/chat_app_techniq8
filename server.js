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
require('./config/socket')(io);
 
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/files', fileRoutes);
 
// Error handling middleware
app.use(errorHandler);
 
// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});