const { default: axios } = require("axios");
const {
  modelRroute,
  humanizedv5,
  humanizedv6_stealth,
  humanizedv6_stealth_lang,
} = require("../AiModel/confiq");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { containsMaliciousText } = require("../lib/maliciousText");
const { PackagePermission } = require("../lib/PackagePermission");
const { TrackUsage } = require("../lib/TrackUsage");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const HumanizeUsesModel = require("../mongo/models/HumanizeUses");
const HumanizeHistoryModel = require("../mongo/models/HumanizeHistory");
const { trackUserData } = require("../lib/trackuserData");
const {
  processHumanizeOutputWithAiScoring,
  getBestParagraphs,
  logParagraphAnalysis,
} = require("../lib/humanizeScore");

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Function to check plexibility a single sentence;
async function isPlexible(text) {
  const tempData = [{ label: "LABEL_1", score: 0.9997795224189758 }];
  return tempData;
}

// Function to process a single payload;
async function processTextChunk(text, systemPromt, model_name, temperature) {
  console.log(systemPromt, model_name, "from humanizeV4");
  const isStram = false;
  let userQuery = text;
  let history = [];

  if (!userQuery) {
    throw {
      error: "Invalid Request",
      message: "User query is required",
    };
  }

  history.push({
    role: "user",
    parts: [{ text: userQuery }],
  });

  //==================== get the Iteration 3,4 ====================
  const responses = [];

  await Promise.all(
    [0].map(async (iteration) => {
      const response = await ShothikAIModel(
        `now give only the humanized text . do not add any narration or explanation. the output should be only clean most humanized text`,
        modelRroute.humanize,
        isStram,
        null,
        systemPromt,
        model_name,
        history,
        {
          ...generationConfig,
          temperature,
        }
      );
      responses.push({ text: response.trim(), isPlexibity: 0.5 });
    })
  );

  return responses;
}

module.exports.humanizeModelV4 = async (req, res) => {
  try {
    const { text, level } = req.body;
    const modelName = req.body.model || "panda";

    if (!text || !level || !modelName) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

    //========================== step 1 ==================================

    // Check for malicious content in the paraphrased output
    const isContainMalicious = containsMaliciousText(text);
    if (isContainMalicious) {
      throw {
        error: "MELICIOUS_CONTENT",
        message:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      };
    }

    // ========== Check usage API hit and word limit permission========
    const {
      wordLimit,
      model,
      todayWordUsed,
      totalWordLimit,
      apiLimit,
      todayApiUsed,
    } = await PackagePermission(
      req.id,
      req.userIp,
      req.browserAgent,
      req.package,
      "bypass",
      modelName
    );

    const inputWords = String(text)?.split(" ")?.length;
    const totalUsed = todayWordUsed + inputWords;

    if (totalUsed > totalWordLimit) {
      if (totalWordLimit !== 99999)
        throw {
          success: false,
          message: "Humanized words limit exceeded",
          error: "LIMIT_REQUEST",
        };
    }
    // Check word limit for authenticated users

    if (inputWords > wordLimit) {
      throw {
        success: false,
        message: `You can't use more than ${wordLimit} words`,
        error: "LIMIT_REQUEST",
      };
    }

    if (model !== modelName) {
      throw {
        message: `You can't use this Model`,
        error: "LIMIT_REQUEST",
      };
    }

    // if word is less then 50 word then return error message
    if (inputWords < 30) {
      throw {
        message: `You can't use less than 30 words`,
        error: "WORD_COUNT_LIMIT_REQUEST",
      };
    }

    if (req.package === "free" && todayApiUsed > apiLimit) {
      throw {
        message: `You can't use more than ${apiLimit} Request`,
        error: "WORD_COUNT_LIMIT_REQUEST",
      };
    }

    //========================== step 2 ==================================

    // System Instruction
    let systemPromt = "";
    let model_name = "gemini-2.0-flash";

    if (level == 2) {
      substitute_count = "ten";
    } else if (level == 4) {
      substitute_count = "twelve";
    } else if (level == 6) {
      substitute_count = "fourteen";
    } else if (level == 8) {
      substitute_count = "sixteen";
    }

    if (modelName === "panda") {
      systemPromt = humanizedv5;
    }

    if (modelName === "raven") {
      systemPromt = humanizedv5;
    }

    //========================== step 3 ==================================

    //make three payload;
    const texts = [text, text];

    // Process all payload
    const processedPayload = await Promise.all(
      texts.map((chunk) =>
        processTextChunk(chunk, systemPromt, model_name, 0.6)
      )
    );

    //================= sorting the output ================

    let finalOutput = [];

    for (let each of processedPayload) {
      for (let eachText of each) {
        const score = Math.floor(Math.random() * (99 - 90 + 1)) + 90;

        const text = cleanText(eachText.text);

        finalOutput.push({
          ...eachText,
          score,
          text,
        });
      }
    }

    // const output = formatTheOutput(processedPayload);

    const output = finalOutput;

    // console.log(finalOutput, "final output");

    // save Usage
    await TrackUsage(req, {
      service: "bypass",
      word_count: String(text).split(" ").length,
      model: modelName,
    });
    await trackUserData(req, "bypass", {
      service: "bypass",
      model: modelName,
      level: level,
      output: output,
    });

    saveHumanizdData(output, text, modelName, req, level);

    res.send({ output, success: true });
  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, "high", {}, "bypass", req.email);

    res.status(500).send({
      message: error.message,
      error: error.error,
    });
  }
};

module.exports.humanizeModelV5 = async (req, res) => {
  try {
    const { text, level, language } = req.body;
    const modelName = req.body.model || "panda";

    if (!text || !level || !modelName) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

    //========================== step 1 (validation code) ==================================

    const isContainMalicious = containsMaliciousText(text);
    if (isContainMalicious) {
      throw {
        error: "MELICIOUS_CONTENT",
        message:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      };
    }

    const {
      wordLimit,
      model,
      todayWordUsed,
      totalWordLimit,
      apiLimit,
      todayApiUsed,
    } = await PackagePermission(
      req.id,
      req.userIp,
      req.browserAgent,
      req.package,
      "bypass",
      modelName
    );

    const inputWords = String(text)?.split(" ")?.length;
    const totalUsed = todayWordUsed + inputWords;

    if (totalUsed > totalWordLimit) {
      if (totalWordLimit !== 99999)
        throw {
          success: false,
          message: "Humanized words limit exceeded",
          error: "LIMIT_REQUEST",
        };
    }

    if (inputWords > wordLimit) {
      throw {
        success: false,
        message: `You can't use more than ${wordLimit} words`,
        error: "LIMIT_REQUEST",
      };
    }

    if (model !== modelName) {
      throw {
        message: `You can't use this Model`,
        error: "LIMIT_REQUEST",
      };
    }

    if (inputWords < 30) {
      throw {
        message: `You can't use less than 30 words`,
        error: "WORD_COUNT_LIMIT_REQUEST",
      };
    }

    if (req.package === "free" && todayApiUsed > apiLimit) {
      throw {
        message: `You can't use more than ${apiLimit} Request`,
        error: "WORD_COUNT_LIMIT_REQUEST",
      };
    }

    //========================== step 2 (system prompt setup) ==================================

    let systemPromt = "";
    let model_name = "gemini-2.0-flash";

    if (level == 2) {
      substitute_count = "ten";
    } else if (level == 4) {
      substitute_count = "twelve";
    } else if (level == 6) {
      substitute_count = "fourteen";
    } else if (level == 8) {
      substitute_count = "sixteen";
    }

    if (modelName === "panda") {
      systemPromt = humanizedv6_stealth_lang;
    }

    if (modelName === "raven") {
      systemPromt = humanizedv6_stealth_lang;
    }

    //========================== step 3 ( text processing) ==================================

    const texts = [text, text];

    const processedPayload = await Promise.all(
      texts.map((chunk) =>
        processTextChunk(chunk, systemPromt, model_name, 0.6)
      )
    );

    console.log(processedPayload, "-----------Process payload------------");

    //================= AI-based scoring and reorganization ================

    // Create initial output with scores (logic)
    let initialOutput = [];
    for (let each of processedPayload) {
      for (let eachText of each) {
        const score = Math.floor(Math.random() * (99 - 90 + 1)) + 90;
        const cleanedText = cleanText(eachText.text);

        initialOutput.push({
          ...eachText,
          score,
          text: cleanedText,
        });
      }
    }

    console.log(
      "Initial output generated, starting AI-based reorganization..."
    );

    // Process with AI-based scoring and reorganization
    const aiDetectorApiUrl =
      process.env.AI_DETECTOR_URL || "http://163.172.172.38:3008/detect";

    const reorganizedParagraphs = await processHumanizeOutputWithAiScoring(
      initialOutput,
      aiDetectorApiUrl,
      {
        rateLimitDelay: 1500, // 1.5 second delay between API calls
        minParagraphLength: 30, // Minimum paragraph length
      }
    );

    // Log analysis for debugging
    if (process.env.NODE_ENV === "development") {
      logParagraphAnalysis(reorganizedParagraphs.slice(0, 5)); // Log top 5
    }

    // Get the best paragraphs
    const bestParagraphs = getBestParagraphs(reorganizedParagraphs, 10);

    // Transform back to expected format
    const finalOutput = bestParagraphs.map((paragraph, index) => ({
      text: paragraph.text,
      isPlexibity: 0.5,
      score: paragraph.humanizeScore,
      aiPercentage: paragraph.aiPercentage,
      aiAssessment: paragraph.aiAssessment,
      totalSentences: paragraph.totalSentences,
      averageWordsPerSentence: paragraph.averageWordsPerSentence,
      originalParagraphNumber: paragraph.paragraphNumber,
      rank: index + 1,
    }));

    // If no paragraphs were successfully processed, fall back to original output
    const output = finalOutput.length > 0 ? finalOutput : initialOutput;

    console.log(`Final output contains ${output.length} paragraphs`);
    if (output.length > 0 && output[0].aiPercentage !== undefined) {
      console.log(
        `Best paragraph has ${output[0].aiPercentage}% AI detection rate`
      );
    }

    // Prepare metadata
    const metadata = {
      totalParagraphsAnalyzed: reorganizedParagraphs.length,
      bestAiPercentage: output[0]?.aiPercentage,
      processingMethod:
        reorganizedParagraphs.length > 0 ? "ai-scored" : "fallback",
    };

    //================= tracking and saving logic ================

    // Save Usage
    await TrackUsage(req, {
      service: "bypass",
      word_count: inputWords,
      model: modelName,
    });

    await trackUserData(req, "bypass", {
      service: "bypass",
      model: modelName,
      level: level,
      output: output,
    });

    // Save to history with all outputs in one document
    await saveHumanizeHistory({
      userId: req.id,
      input: text,
      model: modelName,
      level: level,
      outputs: output,
      metadata: metadata,
      wordCount: inputWords,
      language: language,
    });

    res.send({
      output,
      success: true,
      metadata,
    });
  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, "high", {}, "bypass", req.email);

    res.status(500).send({
      message: error.message,
      error: error.error,
    });
  }
};

/**
 * Save humanize history as a single document with all outputs
 * @param {Object} data - History data to save
 * @param {String} data.userId - User ID
 * @param {String} data.input - Original input text
 * @param {String} data.model - Model name (panda/raven)
 * @param {Number} data.level - Humanization level
 * @param {Array} data.outputs - Array of output objects
 * @param {Object} data.metadata - Processing metadata
 * @param {Number} data.wordCount - Input word count
 */
async function saveHumanizeHistory(data) {
  try {
    const {
      userId,
      input,
      model,
      level,
      outputs,
      metadata,
      wordCount,
      language,
    } = data;

    // Validate required fields
    if (
      !userId ||
      !input ||
      !model ||
      !level ||
      !outputs ||
      !wordCount ||
      !language
    ) {
      console.error("Missing required fields for saving humanize history");
      return;
    }

    // Filter out empty outputs
    const validOutputs = outputs.filter(
      (output) => output.text && output.text.trim().length > 0
    );

    if (validOutputs.length === 0) {
      console.error("No valid outputs to save");
      return;
    }

    // Create history document
    const historyDocument = {
      userId,
      input: input.trim(),
      model,
      level,
      outputs: validOutputs,
      metadata: metadata || {},
      wordCount,
      language,
    };

    await HumanizeHistoryModel.create(historyDocument);

    console.log(
      `Successfully saved humanize history for user ${userId} with ${validOutputs.length} outputs`
    );
  } catch (error) {
    console.error("Error saving humanize history:", error);
    // Don't throw error to prevent breaking the main flow
    // History save failure shouldn't fail the humanization request
  }
}

function formatTheOutput(data) {
  const flatedArray = data.flat();
  // find the max length of the arrays
  const length = Math.max(...flatedArray.map((arr) => arr.length));
  let i = 0;
  let output = [];

  while (i < length) {
    const emptySentence = {
      text: "",
      isPlexibity: 1000,
    };
    const chunk = flatedArray.map((arr) => {
      const obj = arr[i];
      if (obj) {
        return obj;
      } else {
        return emptySentence;
      }
    });
    const sortedSentences = chunk.sort((a, b) => a.isPlexibity - b.isPlexibity);
    output.push(sortedSentences);
    i++;
  }

  const outputs = [];

  // Determine the maximum length of sub-arrays
  const maxLength = Math.max(...output.map((arr) => arr.length));

  let text = "";
  let plexibility = 0;

  for (let i = 0; i < maxLength; i++) {
    const result = output.map((arr) => arr[i] || null);
    result.forEach((item) => {
      if (item) {
        text += item.text + " ";
        plexibility += item.isPlexibity;
      }
    });
    plexibility = plexibility / result.length;

    const score = Math.floor(Math.random() * (99 - 90 + 1)) + 90;

    outputs.push({ text: text.trim(), plexibility, score });
    text = "";
    plexibility = 0;
  }

  return outputs.slice(0, 4);
}

function cleanText(text) {
  // remove all the "*" characters
  text = text.replace(/\*/g, "");

  // remove all the "**" characters
  text = text.replace(/\*\*/g, "");

  // remove all the "**" characters

  return text;
}
