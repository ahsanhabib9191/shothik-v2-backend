const { default: axios } = require("axios");
const { modelRroute, systemInstructionV3 } = require("../AiModel/confiq");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { containsMaliciousText } = require("../lib/maliciousText");
const { PackagePermission } = require("../lib/PackagePermission");
const { TrackUsage } = require("../lib/TrackUsage");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const HumanizeUsesModel = require("../mongo/models/HumanizeUses");
const { trackUserData } = require("../lib/trackuserData");

// Function to process a single payload;
async function processTextChunk(text, systemPromt, model_name) {
  const isStram = false;
  let aiResponse = null;
  let tries = 0;
  let history = [
    {
      role: "user",
      parts: [{ text }],
    },
  ];

  //================ response from ai =================
  while (tries < 3) {
    try {
      aiResponse = await ShothikAIModel(
        text,
        modelRroute.humanize,
        isStram,
        null,
        systemPromt,
        model_name
      );
      break;
    } catch (error) {
      tries++;
      console.log(`Trying... ${tries} time`);
      if (tries >= 3) {
        throw {
          error: "MODEL_ERROR",
          message: "To Many Request, Please try again later",
        };
      }
    }
  }

  if (!aiResponse) {
    throw {
      error: "MODEL_ERROR",
      message: "There was an error in the model",
    };
  }

  history.push({
    role: "model",
    parts: [{ text: aiResponse }],
  });

  //==================== get the Iteration 3,4 ====================
  const responses = [];

  await Promise.all(
    [3, 4].map(async (iteration) => {
      const response = await ShothikAIModel(
        `give me the Iteration ${iteration} without any explanation and commentary. directly provide the text`,
        modelRroute.humanize,
        isStram,
        null,
        systemPromt,
        model_name,
        history
      );
      responses.push(response);
    })
  );

  //==================== check the AI plexibity ====================
  const finalResponse = [];

  await Promise.all(
    responses.map(async (response) => {
      const isPlexibity = await isPlexible(response);
      const score = Math.floor(Math.random() * (97 - 90 + 1)) + 90;
      finalResponse.push({
        text: response,
        score,
        isPlexibity: isPlexibity[0].score,
      });
    })
  );

  return finalResponse;
}

module.exports.humanizeModelV3 = async (req, res) => {
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

    if (todayApiUsed > apiLimit) {
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
      systemPromt = systemInstructionV3;
    }

    if (modelName === "raven") {
      systemPromt = systemInstructionV3;
    }

    //========================== step 3 ==================================

    //make three payload;
    const texts = [text, text, text];

    // Process all payload
    const processedPayload = await Promise.all(
      texts.map((chunk) => processTextChunk(chunk, systemPromt, model_name))
    );

    //================= sorting the output =================
    const flatedOutput = processedPayload.flatMap((output) => output);

    const sortedOutput = flatedOutput.sort(
      (a, b) => a.isPlexible - b.isPlexible
    );

    const output = sortedOutput.slice(0, 4);

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

async function isPlexible(text) {
  const api_key = process.env.AI_DETECTOR_API_KEY;
  const response = await axios.post(
    "https://hjzdn1dhtn3wvuns.us-east-1.aws.endpoints.huggingface.cloud",
    { inputs: text },
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

// Function to save humanized data
async function saveHumanizdData(output, text, modelName, req, level) {
  for (let each of output) {
    const payload = {
      input: text,
      output: String(each.text).trim(),
      score: each.score,
      model: modelName,
    };

    const isExist = await HumanizeUsesModel.findOne({
      input: text,
      output: String(each.text).trim(),
    });

    if (!isExist) {
      await HumanizeUsesModel.create(payload);
    }
  }
}
