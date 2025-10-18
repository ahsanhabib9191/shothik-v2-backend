const express = require("express");
const asyncHandler = require("express-async-handler");
const {
  getProfile,
  updateProfile,
  uploadImage,
  getUserList,
  getUserInfo,
  userLocation,
  checkPackageExpiry,
  getSubscribeLogs,
  getMeetingSettings,
  updateSettings,
  postAffiliateUser,
  getAffiliateUsers,
  getUserInformation,
  getUsersUsingAPI_KEY,
} = require("../controllers/userController");
const { auth } = require("@ridz-shothikai/shothik-auth-service/src/middleware");
const {
  generateSecretKey,
  getSecretKeyDetails,
} = require("../controllers/userSecretController");
const registerUserToBetaList = require("../controllers/registerUserToBetaList");

const router = express.Router();

// Define your routes here
router.get("/profile", auth, asyncHandler(getProfile));
router.get("/get-users-list", asyncHandler(getUsersUsingAPI_KEY));
router.post("/profile-update", auth, asyncHandler(updateProfile));

router.post(`/upload`, asyncHandler(uploadImage));

router.get("/list", asyncHandler(getUserList));
router.get("/info/:id", asyncHandler(getUserInfo));

// generate token
router.post("/generate-secret", auth, asyncHandler(generateSecretKey));
router.get("/secret/:key", auth, asyncHandler(getSecretKeyDetails));

// user location
router.get("/location", asyncHandler(userLocation));

// check-package-expiry
router.get("/check-package-expiry", asyncHandler(checkPackageExpiry));

router.get("/subscribe-logs", asyncHandler(getSubscribeLogs));

// Get the user meeting settings
router.get("/meeting-settings", auth, asyncHandler(getMeetingSettings));

// update meeting minute settings
router.put("/update-meeting-settings", auth, asyncHandler(updateSettings));

// get user details
router.get("/user-information/:email", asyncHandler(getUserInformation));

router.post("/affiliate", postAffiliateUser);
router.get("/affiliate/all", getAffiliateUsers);

// Collect user email for Pre-launch
router.post("/register-to-betalist", asyncHandler(registerUserToBetaList));

// Export the router
module.exports = router;
