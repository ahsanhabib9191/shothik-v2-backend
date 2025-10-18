const jwt = require("jsonwebtoken");
const { User, generateAuthToken } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  CLIENT_URL,
} = require("../config/constant");
const { OAuth2Client } = require("google-auth-library");
const UserSecret = require("@ridz-shothikai/shothik-auth-service/src/models/UserSecret");
const sendEmail = require("../lib/sendEmail");
const { PermissionModel } = require("@ridz-shothikai/shothik-auth-service/src/models/Permission");
const bcrypt = require("bcryptjs");

// const { PublicClientApplication } = require('@azure/msal-node');

// const msalConfig = {
//   auth: {
//     clientId: 'YOUR_CLIENT_ID',
//     authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
//     clientSecret: 'YOUR_CLIENT_SECRET',
//   },
// };
// const microsoftClient = new PublicClientApplication(msalConfig);

// Create OAuth2 client instance
const client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "postmessage"
);

// Verify Google token
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    return { payload: ticket.getPayload() };
  } catch (error) {
    throw new Error("Invalid user detected. Please try again");
  }
};

// Login controller
 const login = async (req, res) => {
  // Get the user input
  const { email, password, auth_type, oneTapLogin } = req.body;


  console.log("ONE TAB LOGIN", oneTapLogin , oneTapLogin==true);
  
  // if auth Login is true then Login the user if not found the user then register the user
  if(oneTapLogin==true){

    const {  oneTapUser } = req.body;

    // Check if the user is in the database
    const user = await User.findOne({ email: oneTapUser.email });
    if(user){
      const token = generateAuthToken(user);
      const payload = {
        _id: user._id,
        email: user.email,
        package: user.package,
        is_verified: user.is_verified,
        token,
      };
      // return the token
       return res.json(payload);
    }else{
      // Register the user 
        // create new user
        const Nuser = await new User({
          name: oneTapUser.name,
          email: oneTapUser.email,
          password: "",
          auth_type:"manual",
          country:"N/A",
          is_verified: true
        }).save();

        // genrate token
        const token = generateAuthToken(Nuser);
        const payload = {
          _id: Nuser._id,
          email: Nuser.email,
          package: Nuser.package,
          is_verified: true,
          token,
        };
        // return the token
        return res.json(payload);
    }

  }


  // Check if the user is in the database
  const user = await User.findOne({ email });

  // If the user is not found, return an error
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (user.status === "disabled") {
    return res.status(404).json({ message: "User disabled" });
  }

  // If the user is found, and the auth_type is manual, check the password
  if (auth_type === "manual") {
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid password" });
    }
  }

  // if auth type is google and password is not provided
  if (auth_type === "google" && !password) {
    // login successfull
  }

  // if not manual and not google then return error
  if (auth_type !== "google" && auth_type !== "manual") {
    return res.status(400).json({ message: "Invalid auth type" });
  }

  // genrate token
  const token = generateAuthToken(user);
  const payload = {
    _id: user._id,
    email: user.email,
    package: user.package,
    is_verified: user.is_verified,
    token,
  };

  // return the token
  res.json(payload);
};

/**
 * IMPORTANT: CAUTION: This services is ow handled on SHOTHIK AUTH NPM PACKAGE
 */

// registration
 const register = async (req, res) => {
  let { name, email, password, auth_type, country } = req.body;

  // validation name
  if (!name || name === "") {
    return res.status(400).json({ message: "Name is required" });
  }

  // name valid or not
  let nameRegEx = /^[a-zA-Z .]+$/;
  if (!nameRegEx.test(name)) {
    return res
      .status(400)
      .json({ message: "Only alphabets and . are allowed in the name" });
  }

  // validation email
  if (!email || email === "") {
    return res.status(400).json({ message: "Email is required" });
  }

  // email valide or not
  let emailRegEx = /\S+@\S+\.\S+/;
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
  if (auth_type === "manual" && !password) {
    // check password length less then 6
    if (password?.length < 6) {
      return res
        .status(400)
        .json({ message: "Password length should be greater then 6" });
    }
    return res.status(400).json({ message: "Password is required" });
  }

  // if google auth type then default password is blank
  if (auth_type === "google") {
    password = "";
  }

  if (auth_type === "google") {
    password = "";
    // Check if we have a refresh token for this user
    if (!user.googleRefreshToken) {
      return res
        .status(400)
        .json({ message: "No Google refresh token found for this user" });
    }

    try {
      // Set up the OAuth2 client with the refresh token
      client.setCredentials({
        refresh_token: user.googleRefreshToken,
      });

      // Generate a new access token
      const { credentials } = await client.refreshAccessToken();

      // Update the user's Google tokens
      user.googleAccessToken = credentials.access_token;
      user.googleTokenExpiryDate = new Date(
        Date.now() + credentials.expiry_date * 1000
      );
      await user.save();
    } catch (error) {
      console.error("Error refreshing Google token:", error);
      return res.status(500).json({ message: "Error refreshing Google token" });
    }
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  // create new user
  const Nuser = await new User({
    name,
    email,
    password: hashedPassword,
    auth_type,
    country,
  }).save();

  // Generate a new token for verify email 5-minute expiration time
  const secretKey = process.env.JWT_SECRET ?? "secret";
  const randomToken = jwt.sign({ userId: Nuser._id }, secretKey, {
    expiresIn: "5m",
  });

  const verifyUrl = `${CLIENT_URL}/auth/verify-email/${randomToken}`;

  await sendEmail({
    name: Nuser.name,
    email: Nuser.email,
    link: verifyUrl,
    type: "email",
  });

  // genrate token
  const payload = {
    _id: Nuser._id,
    email: Nuser.email,
    package: Nuser.package,
    is_verified: Nuser.is_verified,
    token: generateAuthToken(Nuser),
    message: "A Varification link has been sent to your email",
  };

  // return the token
  res.json(payload);
};

// Google login route
 const googleLogin = async (req, res) => {
  const { code, country } = req.body;
  
  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const userInfo = await verifyGoogleToken(tokens.id_token);
    if (!userInfo.payload.email) {
      return res
        .status(400)
        .json({ message: "Invalid email from Google response" });
    }
    const { email, name } = userInfo.payload;
    let user = await User.findOne({ email });

    if (user?.status === "disabled") {
      return res.status(404).json({ message: "User disabled" });
    }

    if (!user) {
      user = await new User({
        name,
        email,
        password: "",
        auth_type: "google",
        country,
        is_verified: true,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiryDate: new Date(Date.now() + tokens.expiry_date * 1000),
      }).save();
      await new PermissionModel({
        user: user._id,
        google: {
          email: email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiryDate: new Date(Date.now() + tokens.expiry_date * 1000),
        },
      }).save();
    } else {
      // Update existing user's Google tokens
      user.googleAccessToken = tokens.access_token;
      user.googleRefreshToken = tokens.refresh_token || user.googleRefreshToken;
      user.googleTokenExpiryDate = new Date(
        Date.now() + tokens.expiry_date * 1000
      );

      await user.save();

      await PermissionModel.updateOne(
        { user: user._id },
        {
          google: {
            email: email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiryDate: new Date(Date.now() + tokens.expiry_date * 1000),
          },
        }
      );
    }

    if (!user.is_verified) {
      // Generate a new token for verify email 5-minute expiration time
      const secretKey = process.env.JWT_SECRET ?? "secret";
      const randomToken = jwt.sign({ userId: user._id }, secretKey, {
        expiresIn: "5m",
      });

      const verifyUrl = `${CLIENT_URL}/auth/verify-email/${randomToken}`;

      await sendEmail({
        name: user.name,
        email: user.email,
        link: verifyUrl,
        type: "email",
      });
    }
    // generate auth token
    const payload = {
      _id: user._id,
      email: user.email,
      package: user.package,
      is_verified: user.is_verified,
      token: generateAuthToken(user),
    };
    res.json(payload);
  } catch (error) {
    console.error("Google login error1:", error);
    res.status(400).json({ error: "Invalid access token" });
  }
};

// Generate Forgot Password Link
 const forgotPassword = async (req, res) => {
  // Get the user input
  const { email } = req.body;

  try {
    // Check if the user is in the database
    const user = await User.findOne({ email });

    // If the user is not found, return an error
    if (!user) {
      return res.status(404).json({ message: "User is not registered yet" });
    }

    // Generate a new token for password reset with a 5-minute expiration time
    const secretKey = process.env.JWT_SECRET ?? "secret";
    const randomToken = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "5m",
    });

    // Find or create the user secret
    await UserSecret.findOneAndUpdate(
      { userId: user._id },
      { secretKey: randomToken },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const resetUrl = `${CLIENT_URL}/auth/reset-password/${randomToken}`;

    await sendEmail({
      name: user.name,
      email: req.body.email,
      link: resetUrl,
      type: "password",
    });

    // return the token
    res
      .status(201)
      .json({ success: true, messsage: "Send email successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Reset Password
 const resetPassword = async (req, res) => {
  // Get the user input
  const { key } = req.params;
  const { password } = req.body;

  try {
    // Verify the JWT token
    const secretKey = process.env.JWT_SECRET ?? "secret";
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
          return res
            .status(400)
            .json({ message: "Password length should be greater than 6" });
        }

        const hashed = bcrypt.hashSync(password, 10);
        user.password = hashed;
        await user.save();

        // Return success response
        return res
          .status(200)
          .json({ success: true, message: "Password updated successfully" });
      } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// resend verify Email
 const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user is in the database
    const user = await User.findOne({ email });

    // If the user is not found, return an error
    if (!user) {
      return res.status(404).json({ message: "User is not registered yet" });
    }

    // Generate a new token for verify email 5-minute expiration time
    const secretKey = process.env.JWT_SECRET ?? "secret";
    const randomToken = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "5m",
    });

    const verifyUrl = `${CLIENT_URL}/auth/verify-email/${randomToken}`;

    console.log(verifyUrl, "verify Url");

    await sendEmail({
      name: user.name,
      email: email,
      link: verifyUrl,
      type: "email",
    });

    // return the token
    res
      .status(201)
      .json({ success: true, messsage: "Send email successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// verify Email
 const verifyEmail = async (req, res) => {
  // Get the user input
  const { key } = req.params;

  const secretKey = process.env.JWT_SECRET ?? "secret";
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
      if (user.is_verified) {
        return res.status(400).json({ message: "Email is already verified" });
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
        token,
      };

      return res.status(200).json({
        success: true,
        message: "Email verify successfully",
        data: payload,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });
};

// Re-Generate token
 const tokenGenerate = async (req, res) => {
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
    token,
  };

  // return the token
  res.json(payload);
};

// User permission
 const userPermission = async (req, res) => {
  const { code, type } = req.body;
  const userId = req.id;

  try {
    if (type === "google") {
      // Exchange the authorization code for tokens
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Verify the Google ID token to get user info
      const userInfo = await verifyGoogleToken(tokens.id_token);

      // Ensure the email is present in the Google response
      if (!userInfo.payload || !userInfo.payload.email) {
        return res.status(400).json({
          success: false,
          message: "Invalid email from Google response",
        });
      }

      const { email } = userInfo.payload;

      // Check if user permissions already exist
      let userPermission = await PermissionModel.findOne({ user: userId });

      let permissionResult;

      const permissionData = {
        google: {
          email: email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiryDate: new Date(Date.now() + tokens.expiry_date * 1000),
        },
      };

      // If permissions don't exist, create a new entry, otherwise update the existing one
      if (!userPermission) {
        userPermission = new PermissionModel({
          user: userId,
          ...permissionData,
        });
        permissionResult = await userPermission.save();
      } else {
        permissionResult = await PermissionModel.updateOne(
          { user: userId },
          permissionData
        );
      }

      return res.json({
        success: true,
        message: "Permission saved successfully",
        data: permissionResult,
      });
    } else {
      return res.status(400).json({ message: "Invalid login type" });
    }
  } catch (error) {
    console.error("Google login error0:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

 const checkPermission = async (req, res) => {
  const userId = req.id;
  try {
    const userPermission = await PermissionModel.findOne({ user: userId });
    if (!userPermission) {
      return res.status(200).json({
        success: false,
        message: "User permission not found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "User permission found",
      data: userPermission,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).josn({ success: false, message: error.message });
  }
};

module.exports = {
  login,
  register,
  googleLogin,
  forgotPassword,
  resetPassword,
  resendVerifyEmail,
  verifyEmail,
  tokenGenerate,
  userPermission,
  checkPermission
};


// (() => {
//   const hashedPassword = bcrypt.hashSync("123456", 10);
//   console.log("PASSWORD:", hashedPassword);
// })();
