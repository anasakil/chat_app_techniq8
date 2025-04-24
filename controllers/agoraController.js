// This is example code for your Node.js server
// Install the agora-access-token package first:
// npm install agora-access-token

const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

// Add this endpoint to your API routes
/**
 * Generate Agora token for real-time video/voice call
 * POST /api/calls/agora-token
 */
exports.generateAgoraToken = async (req, res) => {
    try {
        const { channelName, uid } = req.body;

        // Check for required parameters
        if (!channelName) {
            return res.status(400).json({ message: 'Channel name is required' });
        }

        // Convert uid to number or use 0 if not provided
        const userUid = uid ? Number(uid) : 0;

        // Agora App ID and Certificate (these should be in your environment variables)
        const appID = 'd35effd01b264bac87f3e87a973d92a9';
        const appCertificate = 'd477fb31e67f4a1ca9f362ffeb6c07be';


        // Set token expiration (1 hour)
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Build the token
        const token = RtcTokenBuilder.buildTokenWithUid(
            appID,
            appCertificate,
            channelName,
            userUid,
            RtcRole.PUBLISHER,
            privilegeExpiredTs
        );

        console.log(`Generated Agora token for channel: ${channelName}, uid: ${userUid}`);

        // Return the token
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Error generating Agora token:', error);
        return res.status(500).json({ message: 'Failed to generate token', error: error.message });
    }
};