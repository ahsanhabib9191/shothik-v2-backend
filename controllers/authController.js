const jwt = require('jsonwebtoken');
const { User, generateAuthToken } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const {  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CLIENT_URL, GOOGLE_REDIRECT_URI } = require('../config/constant');

const { OAuth2Client } = require("google-auth-library");
const UserSecret = require("@ridz-shothikai/shothik-auth-service/src/models/UserSecret");
const sendEmail = require("../lib/sendEmail");

// Create OAuth2 client instance
const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);


// Verify Google token
const verifyGoogleToken = async (token) => {
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
      return { payload: ticket.getPayload() };
    } catch (error) {
      throw new Error("Invalid user detected. Please try again");
    }
};

// Login controller
module.exports.loginV2 = async (req, res)  => {
    // Get the user input
    const { email, password, auth_type, code } = req.body;

    // Check if the user is in the database
    const user = await User.findOne({ email });

    // If the user is not found, return an error
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    // If the user is found, and the auth_type is manual, check the password
    if (auth_type === 'manual') {
        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid password" });
        }
        if (!code) {
            // If no code is provided, return the Google OAuth URL
            const url = client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/gmail.readonly', 'profile', 'email']
            });
            return res.json({ url });
        } else {
            try {
                // Exchange the code for tokens
                const { tokens } = await client.getToken(code);

                // Verify the ID token
                const ticket = await client.verifyIdToken({
                    idToken: tokens.id_token,
                    audience: GOOGLE_CLIENT_ID
                });
                const payload = ticket.getPayload();

                // Find or create the user
                if (!user) {
                    user = new User({
                        email: payload.email,
                        name: payload.name,
                        auth_type: 'google'
                    });
                }

                // Update user's Google tokens
                user.googleAccessToken = tokens.access_token;
                user.googleRefreshToken = tokens.refresh_token || user.googleRefreshToken; // Only update if new refresh token is provided
                user.googleTokenExpiryDate = new Date(Date.now() + tokens.expiry_date * 1000);

                await user.save();
            } catch (error) {
                return res.status(400).json({ message: "Error during Google authentication", error: error.message });
            }
        }
    }

    // if auth type is google and password is not provided
    if (auth_type === 'google' && !password) {
         // Check if we have a refresh token for this user
        if (!user.googleRefreshToken) {
            return res.status(400).json({ message: "No Google refresh token found for this user" });
        }

        try {
            // Set up the OAuth2 client with the refresh token
            client.setCredentials({
                refresh_token: user.googleRefreshToken
            });

            // Generate a new access token
            const { credentials } = await client.refreshAccessToken();

            // Update the user's Google tokens
            user.googleAccessToken = credentials.access_token;
            user.googleTokenExpiryDate = new Date(Date.now() + credentials.expiry_date * 1000);
            await user.save();
        } catch (error) {
            console.error('Error refreshing Google token:', error);
            return res.status(500).json({ message: "Error refreshing Google token" });
        }
    }

    // if not manual and not google then return error
    if (auth_type !== 'google' && auth_type !== 'manual') {
        return res.status(400).json({ message: "Invalid auth type" });
    }
    
   
    // genrate token
    const token = generateAuthToken(user);
    const payload = {
        _id: user._id,
        email: user.email,
        package: user.package,
        is_verified: user.is_verified,
        token
    }
   
    // return the token
    res.json(payload);

}

// registration 
module.exports.register = async (req, res) => {
    var { name, email, password, auth_type, country } = req.body;


    // validation name 
    if (!name || name === "") {
        return res.status(400).json({ message: "Name is required" });
    }

    // validation email
    if (!email || email === "") {
        return res.status(400).json({ message: "Email is required" });
    }

    // email valide or not 
    var emailRegEx = /\S+@\S+\.\S+/;
    if (!emailRegEx.test(email)) {
        return res.status(400).json({ message: "Email is invalid" });
    }

    // Check if the user is in the database
    const user = await User.findOne({ email });

    // If the user is found, return an error
    if (user) {
        return res.status(400).json({ message: "User already exists" });
    }

    // if manual auth type is selected and password is not provided
    if (auth_type === 'manual' && !password) {

         // check password length less then 6 
         if (password?.length < 6) {
            return res.status(400).json({ message: "Password length should be greater then 6" });
        }
        return res.status(400).json({ message: "Password is required" });
    }

    // if google auth type then default password is blank
    if (auth_type === 'google') {
        password = '';
    }

    // create new user
    const Nuser = await new User({ name, email, password, auth_type, country }).save();

    // Generate a new token for verify email 5-minute expiration time
    const secretKey = process.env.JWT_SECRET??"secret";
    const randomToken = jwt.sign({ userId: Nuser._id }, secretKey, { expiresIn: '5m' });

    const verifyUrl = `${CLIENT_URL}/auth/verify-email/${randomToken}`;
    
    await sendEmail({
        name: Nuser.name,
        email: Nuser.email,
        subject: "Verify Email",
        message: `<p>You are receiving this email because you need to verify your email.</p> 
                  <p>Please use the following Link: <a href="${verifyUrl}" target="_blank"><strong>Verify Now</strong></a></p>
                  <p>If you did not request this, please ignore this email.</p>
                  <p>Best regards,<br>Shothik AI Team</p>
                `
      });

    // genrate token
    const payload = {
        _id: Nuser._id,
        email: Nuser.email,
        package: Nuser.package,
        is_verified: Nuser.is_verified,
        token: generateAuthToken(Nuser),
        message: "A Varification link has been sent to your email"
    }

    // return the token
    res.json(payload);

}

// Google login route
module.exports.googleLogin = async (req, res) => {
  const { code, country } = req.body; 
  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const userInfo = await verifyGoogleToken(tokens.id_token);
    if (!userInfo.payload.email) {
      return res.status(400).json({ message: "Invalid email from Google response" });
    }
    const {email, name} = userInfo.payload;
    let user = await User.findOne({ email });
    if (!user) {
      user = await new User({ 
            name, 
            email, 
            password:'', 
            auth_type:'google', 
            country ,
            is_verified: true,
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token,
            googleTokenExpiryDate: new Date(Date.now() + tokens.expiry_date * 1000)
        })
    }else {
      // Update existing user's Google tokens
      user.googleAccessToken = tokens.access_token;
      user.googleRefreshToken = tokens.refresh_token || user.googleRefreshToken;
      user.googleTokenExpiryDate = new Date(Date.now() + tokens.expiry_date * 1000);
    }

    await user.save();

    if(!user.is_verified){
        // Generate a new token for verify email 5-minute expiration time
        const secretKey = process.env.JWT_SECRET??"secret";
        const randomToken = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '5m' });

        const verifyUrl = `${CLIENT_URL}/auth/verify-email/${randomToken}`;
        
        await sendEmail({
            name: user.name,
            email: user.email,
            subject: "Verify Email",
            message: `<p>You are receiving this email because you need to verify your email.</p> 
                    <p>Please use the following Link: <a href="${verifyUrl}" target="_blank"><strong>Verify Now</strong></a></p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Best regards,<br>Shothik AI Team</p>
                    `
        });
    }
    // generate auth token
    const payload = {
        _id: user._id,
        email: user.email,
        package: user.package,
        is_verified: user.is_verified,
        token: generateAuthToken(user)
    } 
    res.json(payload);
  } catch (error) {
    console.error("Google login error2:", error);
    res.status(400).json({ error: "Invalid access token" });
  }
};


// Generate Forgot Password Link
module.exports.forgotPassword = async (req, res)  => {
    // Get the user input
    const { email } = req.body;

    try{
        // Check if the user is in the database
    const user = await User.findOne({ email });

    // If the user is not found, return an error
    if (!user) {
        return res.status(404).json({ message: "User is not registered yet" });
    }

    // Generate a new token for password reset with a 5-minute expiration time
    const secretKey = process.env.JWT_SECRET??"secret";
    const randomToken = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '5m' });

    // Find or create the user secret
    await UserSecret.findOneAndUpdate(
        { userId : user._id },
        { secretKey: randomToken },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const resetUrl = `${CLIENT_URL}/auth/reset-password/${randomToken}`;
    
    await sendEmail({
        name: user.name,
        email: req.body.email,
        subject: "Forgot Password",
        message: `<p>You are receiving this email because you requested to reset your password.</p> 
                  <p>Please use the following Link: <a href="${resetUrl}" target="_blank"><strong>Reset Password</strong></a></p>
                  <p>If you did not request this, please ignore this email.</p>
                  <p>Best regards,<br>Shothik AI Team</p>
                  `
      });
   
    // return the token
    res.status(201).json({success: true, messsage: "Send email successfully"});

    }catch(error){
        return res.status(500).json({success: false, message: error.message})
    }

}

// Reset Password
module.exports.resetPassword = async (req, res) => {
    // Get the user input
    const { key } = req.params;
    const { password } = req.body;

    try {
        // Verify the JWT token
        const secretKey = process.env.JWT_SECRET??"secret";
        jwt.verify(key, secretKey, async (err, decoded) => {
            if (err) {
                return res.status(400).json({ message: "Invalid or expired token" });
            }

            const userId = decoded.userId;

            try {
                // Check if the user exists
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                // Update the user's password
                if (!password) {
                    return res.status(400).json({ message: "Password is required" });
                }
                if (password.length < 6) {
                    return res.status(400).json({ message: "Password length should be greater than 6" });
                }
                user.password = password;
                await user.save();

                // Return success response
                return res.status(200).json({ success: true, message: "Password updated successfully" });
            } catch (error) {
                return res.status(500).json({ success: false, message: error.message });
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


// resend verify Email 
module.exports.resendVerifyEmail = async (req, res) => {
    const { email } = req.body;

    try{
        // Check if the user is in the database
        const user = await User.findOne({ email });

        // If the user is not found, return an error
        if (!user) {
            return res.status(404).json({ message: "User is not registered yet" });
        }

        // Generate a new token for verify email 5-minute expiration time
        const secretKey = process.env.JWT_SECRET??"secret";
        const randomToken = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '5m' });

        const verifyUrl = `${CLIENT_URL}/auth/verify-email/${randomToken}`;
        
        await sendEmail({
            name: user.name,
            email: email,
            subject: "Verify Email",
            message: `<p>You are receiving this email because you need to verify your email.</p> 
                    <p>Please use the following Link: <a href="${verifyUrl}" target="_blank"><strong>Verify Now</strong></a></p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Best regards,<br>Shothik AI Team</p>
                    `
        });

        // return the token
        res.status(201).json({success: true, messsage: "Send email successfully"});

    }catch(error){
        return res.status(500).json({success: false, message: error.message})
    }

}


// verify Email 
module.exports.verifyEmail = async (req, res) => {
    // Get the user input
    const { key } = req.params;

    const secretKey = process.env.JWT_SECRET??"secret";
        jwt.verify(key, secretKey, async (err, decoded) => {
            if (err) {
                return res.status(400).json({ message: "Invalid or expired token" });
            }

            const userId = decoded.userId;

            try {
                // Check if the user exists
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }
                
                user.is_verified = true;
                await user.save();

                // genrate token
                const token = generateAuthToken(user);
                const payload = {
                    _id: user._id,
                    email: user.email,
                    package: user.package,
                    is_verified: user.is_verified,
                    token
                }
            
                return res.status(200).json({ success: true, message: "Email verify successfully", data: payload });
            } catch (error) {
                return res.status(500).json({ success: false, message: error.message });
            }
        });

}


// Re-Generate token
module.exports.tokenGenerate = async (req, res)  => {
    // Get the user input
    const uerId = req.id;

    // Check if the user is in the database
    const user = await User.findOne({ _id: uerId });

    // If the user is not found, return an error
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
   
    // generate token
    const token = generateAuthToken(user);
    const payload = {
        _id: user._id,
        email: user.email,
        package: user.package,
        is_verified: user.is_verified,
        token
    }
   
    // return the token
    res.json(payload);

}
