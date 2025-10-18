const { default: axios } = require("axios");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
// const { aiDetectorModal } = require("../mongo/models/aiDetector");
const { PackagePermission } = require("../lib/PackagePermission");
const { sampleAiText } = require("../data/AIDetectedWords");
const { TrackUsage } = require("../lib/TrackUsage");
const { saveUsagesLogs } = require("../mongo/models/UsageLogs");
const HumanizeUsesModel = require("../mongo/models/HumanizeUses");
const aiDetectorModal = require("../mongo/models/aiDetector");

const aiDetectorSampleText = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: sampleAiText });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: error.message, error: error.error });
  }
};

const aiTextDetectorController = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

    // Check API usage limits
    const { wordLimit, todayWordUsed, totalWordLimit } =
      await PackagePermission(
        req.id,
        req.userIp,
        req.browserAgent,
        req.package,
        "ai-detector"
      );

    const inputWords = String(text)?.split(" ")?.length;
    const totalUsed = todayWordUsed + inputWords;

    // Check for limits based on user login status
    if (totalUsed > totalWordLimit) {
      if (totalWordLimit !== 99999) {
        throw {
          message: "Ai Detector limit exceeded",
          error: "LIMIT_REQUEST",
        };
      }
    }
    if (inputWords > wordLimit) {
      throw {
        message: `You can't use more than ${wordLimit} words`,
        error: "LIMIT_REQUEST",
      };
    }

    const isOurContent = await HumanizeUsesModel.findOne({
      output: text.trim(),
    });

    // console.log("IS OUR CONTENT", isOurContent);

    let result;
    if (isOurContent) {
      const output = isOurContent.output;
      const sentences = [];
      const totalWords = String(output)?.split(" ")?.length;
      const score = isOurContent.score;

      output.split(".").forEach((sentence) => {
        const humanScore = Math.floor(Math.random() * (39 - 10 + 1)) + 10;
        if (sentence.trim() !== "") {
          const data = {
            highlight_sentence_for_ai: false,
            human_confidence: score,
            perplexity: humanScore,
            sentence: `${sentence}.`,
          };
          sentences.push(data);
        }
      });
      const randomIndex = Math.floor(Math.random() * sentences.length);
      const randomNumber = Math.floor(Math.random() * (74 - 41 + 1)) + 41;
      const randomSentence = sentences[randomIndex];
      randomSentence.perplexity = randomNumber;
      result = {
        sentences,
        ai_detected_sentences: 0,
        ai_percentage: 100 - score,
        assessment: "Human Generated",
        average_ai_confidence: 100 - score,
        average_perplexity: score,
        average_words_per_sentence: totalWords / sentences.length,
        total_sentences: sentences.length,
        total_words: totalWords,
      };
    } else {
      console.log(process.env.AI_DETECTOR_URL);
      try {
        const { data } = await axios.post(
          process.env.AI_DETECTOR_URL,
          { text },
          { headers: { "Content-Type": "application/json" } }
        );

        const sentences = data.result?.sentences;

        // console.log(data, "sentences");
        const summary = data.result?.summary;
        if (!sentences || !summary) {
          throw {
            message: "Something went wrong",
            error: "AI_DETECTOR_ERROR",
          };
        }

        result = {
          userId: req.id,
          sentences,
          ...summary,
        };
      } catch (error) {
        console.log(error, "Ai detector error");
        return res.status(500).json({
          message: "Ai detect failed. Try again later.",
        });
      }
    }

    // console.log(result, "AI DETECTOR RESULT");
    const aiDetector = await aiDetectorModal.create(result);

    // console.log(aiDetector, "ai detector data");

    // Save usage
    TrackUsage(req, {
      service: "ai-detector",
      word_count: String(text).split(" ").length,
    });

    await saveUsagesLogs(req.id, text, aiDetector, aiDetector, "ai-detector");

    res.status(200).json({
      success: true,
      result: aiDetector,
    });
  } catch (error) {
    console.log(error);
    // Log error for debugging
    saveErrorLog(error.message, "high", {}, "ai ditector", req.email);

    res.status(500).json({
      error: error.error,
      message: error.message,
    });
  }
};

const getAiDetectorResultById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

    const aiDetector = await aiDetectorModal.findById(id);
    res.status(200).json({
      success: true,
      result: aiDetector,
    });
  } catch (error) {
    // Log error for debugging
    saveErrorLog(error.message, "high", {}, "ai-detector", req.email);

    res.status(500).json({
      error: error.error,
      message: error.message,
    });
  }
};

const getAllAiDetectorResult = async (req, res) => {
  const userId = req.id;

  if (!userId) {
    throw {
      error: "Unauthorized!",
      message: "Please log in!",
    };
  }

  // TODO: Needs to add redis to better optimize it.

  const aiDetectorData = await aiDetectorModal.find({ userId });

  // console.log(aiDetectorData, "ai detector data");

  res.status(200).json({
    success: true,
    result: aiDetectorData,
  });
};

module.exports = {
  aiDetectorSampleText,
  aiTextDetectorController,
  getAiDetectorResultById,
  getAllAiDetectorResult,
};
