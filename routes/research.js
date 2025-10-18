const express = require("express");
const { auth } = require("@ridz-shothikai/shothik-auth-service/src/middleware");
const AsyncHandler = require("express-async-handler");
const ResearchAiService = require("../services/researchService");

const router = express.Router();

router.use(auth);

const researchAiService = new ResearchAiService();

router.post(
  "/register-research-service",
  AsyncHandler(async (req, res) => {
    try {
      const { email } = req.body;

      const result = await researchAiService.registerResearchService(email);

      res.send(result);
    } catch (error) {
      console.error(
        "Research AI service error when trying to authenticated:",
        error
      );
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  })
);

module.exports = router;