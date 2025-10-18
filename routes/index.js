// router setup for the api
const express = require("express");
const {
  GenerateSampleTextController,
} = require("../controllers/generateSampleText");
const {
  paraphraseController,
  paraphraseControllerWithVariant,
} = require("../controllers/paraphrase");

const {
  summarizerKeywordsController,
  summarizerController,
} = require("../controllers/summarize");
const { contentWriterController } = require("../controllers/contentWriter");

const {
  synonymsController,
  synonymsControllerV3,
  getSynonymsTokensV3,
} = require("../controllers/synonyms");

const {
  saveAudioFile,
  KeyNotesController,
  KeyNoteByIdController,
  reGenerateKeyNoteController,
} = require("../controllers/meeting_keynote");

const {
  authOptional,
  auth,
  verifyAuth,
} = require("@ridz-shothikai/shothik-auth-service/src/middleware");
const validPackage = require("../middleware/validPackage.js");
const { translator_v2 } = require("../controllers/translator/translator_v2.js");
const fileUpload = require("../middleware/fileUpload.js");
const {
  getMyMeeting,
  updateMeeting,
  deleteMeeting,
  singleMeeting,
  ratingMeeting,
  averageRating,
  getAllMeeting,
  sendMeetingEmail,
  deleteMultipleMeetings,
  convertMeetingPDF,
  updateMeetingVisibility,
  createTableMeetingMinute,
  transcribeFromFile,
  testMeetingMinute,
} = require("../controllers/meetingMinutesController.js");
const docConverter = require("../middleware/docConverter.js");
const { getErrorLogs } = require("../controllers/logController.js");
const { spellChecker } = require("../controllers/spell_checker.js");
const { UserLimit, usesLimit } = require("../controllers/UserLimit.js");
const { humanizeModel } = require("../controllers/humanizer/humanizeModel.js");
const {
  FixGrammar,
  FixGrammarWithVariant,
} = require("../controllers/fix-grammar.js");
const { humanizeModelV2 } = require("../controllers/humanizeV2.js");
const permissionChecker = require("../middleware/permissionChecker.js");
const {
  aiTextDetectorController,
  aiDetectorSampleText,
  getAiDetectorResultById,
  getAllAiDetectorResult,
} = require("../controllers/aiDetector.js");
const {
  submitContact,
  getContacts,
} = require("../controllers/contactController.js");
const {
  HumanizeSampleTextHandler,
  paraphraseSampleTextHandler,
  rephraseSampleTexthandler,
  aiDitectorSampleText,
  aiDitectorSampleTextForShare,
  fixGrammarSampleTextHandler,
  summerizeSampleTextHandler,
} = require("../middleware/sample-text-handler.js");
const { humanizeModelV3 } = require("../controllers/humanizeV3.js");
const {
  humanizeModelV4,
  humanizeModelV5,
} = require("../controllers/humanizeV4.js");
const {
  paraphrasePlainOutput,
  paraphraseWithVariantV2,
  taggingIndivisualSentence,
} = require("../controllers/paraphraseV2.js");
const {
  getResearh,
  suggestQuestions,
  fetchMetadata,
  getTrending,
} = require("../controllers/research/research.js");
const { getSession, getSessionById } = require("../controllers/agent.js");
const {
  getHumanizeHistory,
  getHumanizeHistoryById,
  deleteHumanizeHistory,
  getHumanizeStats,
} = require("../controllers/humanizeHistory.js");
const {
  grammarChecker,
  getGrammarSections,
  grammarSectionRename,
  grammarSectionDelete,
  getGrammarSection,
} = require("../controllers/gammer_checker.js");
const router = express.Router();

// File Upload
router.post("/file/upload", fileUpload, async (req, res) => {
  const url = req.url;
  const ext = req.ext;
  const name = req.filename;
  const metaData = req.fileMeta;
  res.send({ name, url, ext, metaData });
});

//  Generate Sample Text
router.post("/generateSampleText", GenerateSampleTextController);
router.get("/generateSampleText", GenerateSampleTextController);

// ---------------------- model routes ---------------------- //

// -------- paraphrase routes start --------- //
router.post(
  "/paraphrase",
  paraphraseSampleTextHandler,
  verifyAuth,
  validPackage,
  permissionChecker("paraphrase", true),
  paraphraseController
);
router.post(
  "/paraphrase-with-variant",
  rephraseSampleTexthandler,
  verifyAuth,
  validPackage,
  permissionChecker("paraphrase", true),
  paraphraseControllerWithVariant
);
router.post("/synonyms", verifyAuth, validPackage, synonymsController);

//paraphrase v2 started
router.post(
  "/paraphraseV2",
  verifyAuth,
  validPackage,
  permissionChecker("paraphrase", true),
  paraphrasePlainOutput
);

router.post(
  "/paraphrase-with-variantV2",
  verifyAuth,
  validPackage,
  permissionChecker("paraphrase", true),
  paraphraseWithVariantV2
);
router.post("/paraphrase-for-tagging", verifyAuth, taggingIndivisualSentence);
//v2 end
// -------- paraphrase routes end --------- //

// ------- summarizer routes start --------- //
router.post(
  "/summarize-keywords",
  summerizeSampleTextHandler,
  verifyAuth,
  validPackage,
  summarizerKeywordsController
);
router.post(
  "/summarize",
  summerizeSampleTextHandler,
  verifyAuth,
  validPackage,
  summarizerController
);
// ------- summarizer routes end --------- //

// --------- grammar routes start --------- //
router.post(
  "/fix-grammar",
  fixGrammarSampleTextHandler,
  verifyAuth,
  validPackage,
  FixGrammar
);
router.post(
  "/fix-grammar-with-variant",
  verifyAuth,
  validPackage,
  FixGrammarWithVariant
);
router.post("/spell-check", verifyAuth, validPackage, spellChecker);
router.post("/grammar/check", verifyAuth, validPackage, grammarChecker);
router.get("/grammar/sections", verifyAuth, validPackage, getGrammarSections);
router.get("/grammar/section/:id", verifyAuth, validPackage, getGrammarSection);
router.put(
  "/grammar/section-rename/:id",
  verifyAuth,
  validPackage,
  grammarSectionRename
);
router.delete(
  "/grammar/section-delete/:id",
  verifyAuth,
  validPackage,
  grammarSectionDelete
);
// --------- grammar routes end --------- //

// ----------- humaanizer routes start --------- //
router.post(
  "/humanizerV2",
  HumanizeSampleTextHandler,
  verifyAuth,
  validPackage,
  humanizeModelV2
);
router.post(
  "/humanizerV3",
  verifyAuth,
  HumanizeSampleTextHandler,
  validPackage,
  humanizeModelV3
);
/**
 * /humanizerV4 -> This version feature 👇
 * 1. Generate 2 draft file out. Which contains everything all together like -
 * -> Parapgraph variants, total 5 for each drafts
 * -> Perplexity scores & burstiness scores.
 
 * 2. Draw backs
 * -> As everything comes together no way of showing separate paragraph on the frontend.
 * -> New requirement demands ai check. So adding for isolation & versioning decided to make a new version with ai check paragraphs
 */
router.post(
  "/humanizerV4",
  HumanizeSampleTextHandler,
  verifyAuth,
  validPackage,
  humanizeModelV4
);

/**
 * /humanizerV5 -> This version feature 👇
 * 1. Updated output to handle ai check on every parapgraph varitions.
 * 2. Organized output to handle humanize paragraphs based on ai scores.
 * 3. Separated parapgraphs for better handling on frontend AS business logic is now to show humanize content paragraphs single time with move next + previous feature.
 */

router.post(
  "/humanizerV5",
  HumanizeSampleTextHandler,
  verifyAuth,
  validPackage,
  humanizeModelV5
);

/**
 * /gpt -> Humanize GPT history
 */
router.get("/gpt-history", verifyAuth, getHumanizeHistory);
router.get("/gpt-history/:id", verifyAuth, getHumanizeHistoryById);
router.delete("/gpt-history/:id", verifyAuth, deleteHumanizeHistory);
router.get("/gpt-stats", verifyAuth, getHumanizeStats);
// ----------- humaanizer routes end --------- //

// --------- translator routes start --------- //
router.post("/translator", verifyAuth, validPackage, translator_v2);
// --------- translator routes end --------- //

//----------- ai detector routes start --------- //
router.post(
  "/ai-detector",
  aiDitectorSampleText,
  verifyAuth,
  validPackage,
  aiTextDetectorController
);
router.get("/ai-detector/sampleText", aiDetectorSampleText);
router.get(
  "/ai-detector/share/:id",
  aiDitectorSampleTextForShare,
  verifyAuth,
  getAiDetectorResultById
);
router.get("/ai-detector", verifyAuth, getAllAiDetectorResult);
//----------- ai detector routes end --------- //

// ------------ research routes start ------------ //
router.post("/research", verifyAuth, validPackage, getResearh);
router.post("/research/questions", suggestQuestions);
router.post("/research/meta", fetchMetadata);
router.get("/research/trending-queries", getTrending);
// ------------ research routes end ------------ //

//------------- deprecated api start -------------//
// deprecated from;
router.post("/synonyms-v3", synonymsControllerV3);
router.post("/get-synonym-tokens-v3", getSynonymsTokensV3);
// till here;
//deprecated api;
router.post("/humanizer", authOptional, validPackage, humanizeModel);
//deprecated api;
router.post("/transcribe", authOptional, transcribeFromFile);
// ------------- deprecated api end ------------//

//---------------------- Agent start -----------------------
router.post("/agent/session", verifyAuth, getSession);
router.get("/agent/session/:session_id", verifyAuth, getSessionById);
//---------------------- Agent end -----------------------

// meeting minutes
router.post("/meeting-minute", authOptional, createTableMeetingMinute);
router.get("/all-meetings", getAllMeeting);
router.get("/my-meetings", auth, getMyMeeting);
router.get("/meeting-minute/:id", authOptional, singleMeeting);
router.put("/meeting-minute/edit/:id", auth, updateMeeting);
router.put("/meeting-minute/visibility/:id", auth, updateMeetingVisibility);
router.delete("/meeting-minute/delete/:id", auth, deleteMeeting);
router.delete("/meeting-minutes/delete", auth, deleteMultipleMeetings);
router.post("/test-meeting-minute", authOptional, testMeetingMinute);
// meeting rating
router.post("/rating/create/:id", auth, ratingMeeting);
router.get("/rating/get/:id", averageRating);
// meeting email
router.post("/meeting/email/:id", auth, sendMeetingEmail);
// meeting pdf
router.post("/meeting/pdf/:id", auth, convertMeetingPDF);
// work with audio
router.post("/save-audio", saveAudioFile);
router.get("/regenerate/:id", reGenerateKeyNoteController);

// Keynotes
router.get("/key-notes/:browserId", KeyNotesController);
router.get("/key-note/:id", KeyNoteByIdController);

// Content Write
router.post("/contentWriter", contentWriterController);

// Error Logs
router.get("/error-logs", getErrorLogs);
// Limit
router.get("/user-limit", authOptional, UserLimit);
//auth routes
router.post("/uses-limit", verifyAuth, usesLimit);
// Convert Doc to text
router.post("/doc-text", docConverter, async (req, res) => {
  const text = req.convertedText;
  res.send(text);
});

router.post("/contact", submitContact);
router.get("/contacts", getContacts);

// export router
module.exports = router;
