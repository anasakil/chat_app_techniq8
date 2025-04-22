// controllers/agoraController.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

// Hard-coded Agora credentials - for development only
// In production, use environment variables instead
const AGORA_APP_ID = 'd35effd01b264bac87f3e87a973d92a9';
const AGORA_APP_CERTIFICATE = 'd477fb31e67f4a1ca9f362ffeb6c07be';

// @desc    Generate an Agora token for a channel
// @route   POST /api/calls/agora-token
// @access  Private
const generateAgoraToken = async (req, res, next) => {
    try {
        const { channelName, uid } = req.body;
        
        // Validate input
        if (!channelName) {
            return res.status(400).json({ message: 'Channel name is required' });
        }
        
        // Set role and expiration time
        const role = RtcRole.PUBLISHER;
        
        // Token expires in 3600 seconds (1 hour)
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
        
        // Build the token
        let token;
        if (uid) {
            // For existing user ID (string or number)
            token = RtcTokenBuilder.buildTokenWithUid(
                AGORA_APP_ID, 
                AGORA_APP_CERTIFICATE, 
                channelName, 
                uid, 
                role, 
                privilegeExpiredTs
            );
        } else {
            // Generate a token with random uid
            const randomUid = Math.floor(Math.random() * 100000);
            token = RtcTokenBuilder.buildTokenWithUid(
                AGORA_APP_ID, 
                AGORA_APP_CERTIFICATE, 
                channelName, 
                randomUid, 
                role, 
                privilegeExpiredTs
            );
        }
        
        // Send the token back to the client
        res.json({ 
            token,
            channelName,
            uid: uid || randomUid,
            expiresIn: expirationTimeInSeconds
        });
    } catch (error) {
        console.error('Error generating Agora token:', error);
        next(error);
    }
};

module.exports = {
    generateAgoraToken
};