const express = require('express');
const asyncHandler = require('express-async-handler');

const { login, register, googleLogin, forgotPassword, resetPassword, resendVerifyEmail, verifyEmail, tokenGenerate, userPermission, checkPermission, } = require('../controllers/authControll');

// const { auth } = require('../middleware/auth');
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');

const { loginV2 } = require('../controllers/authController');
const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CLIENT_URL, GOOGLE_REDIRECT_URI } = require('../config/constant');
const { User } = require('@ridz-shothikai/shothik-auth-service/src/models/User');
const router = express.Router();

// Define your routes here
router.post('/login', asyncHandler(login));
router.post('/register', asyncHandler(register));
router.post('/google-login', asyncHandler(googleLogin));
router.get('/token-generate', auth, asyncHandler(tokenGenerate));

// reset
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password/:key', asyncHandler(resetPassword));

// reset
router.post('/send-verify-email', asyncHandler(resendVerifyEmail));
router.post('/verify-email/:key', asyncHandler(verifyEmail));


// ===================Auth V 2.0 =========================
const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

router.post('/v2/login', asyncHandler(loginV2));

router.get('/v2/google', (req, res) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',  // This will force a refresh token to be generated
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'profile', 'email'],
    prompt: 'consent'  // This forces the consent screen to appear every time, ensuring a refresh token is always returned
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    // Exchange the code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info from the ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    // Find or create user
    let user = await User.findOne({ email });
    // if (!user) {
    //   user = new User({
    //     email,
    //     name: payload.name,
    //     auth_type: 'google'
    //   });
    // }

    // Update user with new tokens
    user.googleAccessToken = tokens.access_token;
    user.googleRefreshToken = tokens.refresh_token;
    user.googleTokenExpiryDate = new Date(Date.now() + tokens.expiry_date * 1000);

   const data = await user.save();

    // Redirect to a success page or send a response
    res.send(data);  // Or wherever you want to redirect after successful login
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});


// ===================User Permission =========================
router.post('/user-permission', auth, asyncHandler(userPermission));
router.get('/check-permission', auth, asyncHandler(checkPermission));

// Export the router
module.exports = router;
