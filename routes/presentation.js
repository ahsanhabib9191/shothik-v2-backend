const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
// const { auth } = require("./../middleware/auth.js");
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const {
  initiatePresentation,
  presentationLogs,
  presentationSlides,
  postMessage,
  getAllPresentationSlides,
  uploadFileToAgents,
} = require("../controllers/presentationController.js");

// Rate limiting: 250 requests per 2 minutes per user
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 250,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting and authentication to all routes
router.use(limiter);
router.use(auth);

// Presentation Routes
router.post(
  "/init",
  AsyncHandler(async (req, res) => {
    try {
      const { message, file_urls } = req.body;
      // console.log(file_urls, "file urs");
      // return;
      const userId = req.id; // Extracted from JWT by auth middleware
      const result = await initiatePresentation({ message, file_urls, userId });
      res.json({ ...result, userId });
    } catch (error) {
      console.error("[presentation] Error in /init route:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  })
);

router.get(
  "/logs/:id",
  AsyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.id;
      const result = await presentationLogs(id, userId);
      res.json(result);
    } catch (error) {
      console.error("[presentation] Error in /logs/:id route:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  })
);

router.get(
  "/slides/:id",
  AsyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.id;
      const result = await presentationSlides(id, userId);
      res.json(result);
    } catch (error) {
      console.error("[presentation] Error in /slides/:id route:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  })
);

router.get(
  "/get-slides",
  AsyncHandler(async (req, res) => {
    try {
      const userId = req.id;
      const result = await getAllPresentationSlides(userId);

      res.json(result);
    } catch (error) {
      console.error("[presentation] Error in /get-slides:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  })
)

// CHAT Route
router.post(
  "/chat/:id",
  AsyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const userId = req.id;
      const result = await handleChatMessage({ presentationId: id, userId, message });
      res.json(result);
    } catch (error) {
      console.error("[presentation] Error in /chat/:id route:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  })
);

// UPDATE slides route
router.post(
  "/chat/message/:id",
  AsyncHandler(async (req, res) => {
    try {
      const {id} = req.params;
      const {user_query} = req.body;
      const userId = req.id;

      // console.log(id, user_query, " <------ from chat message");

      const result = await postMessage(id, user_query, userId);

      res.json(result);
    } catch (error) {
      console.error("[presentation] Error in /slides/update/:id route:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  })
)

// Upload files route
router.post("/upload-files", AsyncHandler(async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    // 'files' will be an object if one file is uploaded, or an array if multiple.
    // It's good practice to normalize it to an array.
    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files];

    const { userId } = req.body;

    // console.log(`${files.length} file(s) received.`, files, userId, "upload files");

    const result = await uploadFileToAgents(files, userId);

    console.log(result, "result of upload files");

    res
      .status(200)
      .json({ success: true, message: "Files uploaded successfully", data: result || [] });
    
  } catch (error) {
    console.log("[Presentation] Error in /slides/upload-files route:", error);
    return res.status(500).json({success: false, message: error.message});
  }
}))


module.exports = router;
