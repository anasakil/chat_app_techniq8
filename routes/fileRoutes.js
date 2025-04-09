// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const { uploadDirectFile, downloadFile, deleteFile } = require('../controllers/fileController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
 
router.post('/upload-direct', auth, upload.single('file'), uploadDirectFile);
router.get('/:messageId', auth, downloadFile);
router.delete('/:messageId', auth, deleteFile);
 
module.exports = router;