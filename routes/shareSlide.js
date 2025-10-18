const express = require("express");
const router = express.Router();
// const { body, param } = require("express-validator");
const shareController = require("../controllers/shareController");
// const {auth} = require("../middleware/auth");
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const rateLimit = require("express-rate-limit");

// Rate limiter for share link generation
const generateLinkLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit to 50 requests per window
  message: "Too many share link requests, please try again later.",
});

// Middleware to validate presentationId
// const validatePresentationId = [
//   param("presentationId").isMongoId().withMessage("Invalid presentation ID"),
// ];

// Middleware to validate share settings
// const validateShareSettings = [
//   body("isDiscoverable").isBoolean().optional(),
//   body("requireSignIn").isBoolean().optional(),
//   body("allowComments").isBoolean().optional(),
//   body("allowDownload").isBoolean().optional(),
//   body("trackViews").isBoolean().optional(),
//   body("password").optional().isString().trim(),
//   body("expiryDate").optional().isISO8601().toDate(),
// ];

// Routes
router.post(
  "/:presentationId/generate",
  auth,
  generateLinkLimiter,
//   validatePresentationId,
  shareController.generateShareLink
);

router.put(
  "/:presentationId/settings",
  auth,
//   validatePresentationId,
//   validateShareSettings,
  shareController.updateShareSettings
);

router.get(
  "/:presentationId/analytics",
  auth,
//   validatePresentationId,
  shareController.getAnalytics
);

router.get("/shared/:shareLink", shareController.accessSharedPresentation);

router.post("/track-view/:shareId", shareController.trackView);

module.exports = router;
