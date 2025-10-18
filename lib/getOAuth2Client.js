const { google } = require('googleapis');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = require('../config/constant');
const { PermissionModel } = require('@ridz-shothikai/shothik-auth-service/src/models/Permission');

async function getOAuth2Client(user) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  // Set credentials using the user's access and refresh tokens
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  // Check if the token is expired or expiring soon
  const now = Date.now();
  const tokenExpiry = oauth2Client.credentials.expiry_date || 0;

  if (tokenExpiry <= now) {
    console.log('Token is expired or expiring soon, refreshing...');

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        user.googleAccessToken = credentials.access_token;

        if (credentials.refresh_token) {
            user.googleRefreshToken = credentials.refresh_token;
        }

        // Save the updated tokens
        await user.save();

        await PermissionModel.updateOne({ user: user._id }, { 
            google: {
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token,
                tokenExpiryDate: tokenExpiry
            }
        });

      console.log('Token refreshed and saved');
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  // Verify token validity (optional)
  try {
    await oauth2Client.getTokenInfo(user.googleAccessToken);
  } catch (error) {
    console.error('Invalid or expired access token:', error);
    throw error;
  }

  return oauth2Client;
}

module.exports = {
    getOAuth2Client,
}
