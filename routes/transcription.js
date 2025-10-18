const express = require("express");
const { Filetranscribtion, meetingTranscribtion, transcribtionFroTranslate } = require("../controllers/transcribtionController");
const { FiletranscribtionInJSONFOrmat } = require("../controllers/transcriptionJsonController");
const router = express.Router();




router.post('/transcribe',  Filetranscribtion);
router.post('/transcribe-in-json-format',  FiletranscribtionInJSONFOrmat);
router.post('/meeting',  meetingTranscribtion);
router.post('/translate',  transcribtionFroTranslate);

// export router
module.exports = router;
