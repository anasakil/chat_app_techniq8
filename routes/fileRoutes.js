const express = require('express');
const router = express.Router();
const { uploadFile, downloadFile, deleteFile } = require('../controllers/fileController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/upload', auth, upload.single('file'), uploadFile);
router.get('/:messageId', auth, downloadFile);
router.delete('/:messageId', auth, deleteFile);

module.exports = router;
