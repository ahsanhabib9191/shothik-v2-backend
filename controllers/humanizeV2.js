const { modelRroute, systemInstruction } = require("../AiModel/confiq");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { containsMaliciousText } = require("../lib/maliciousText");
const { PackagePermission } = require("../lib/PackagePermission");
const { TrackUsage } = require("../lib/TrackUsage");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const HumanizeUsesModel = require("../mongo/models/HumanizeUses");
const { saveUsagesLogs } = require("../mongo/models/UsageLogs");

// Function to split text into chunks
function textArray(text, wordLimit = 100) {
  const words = text.split(/\s+/); // Split text into words
  const chunks = [];
  let currentChunk = "";

  if (words.length <= wordLimit) {
    return [text];
  }

  words.forEach((word) => {
    if (currentChunk.length + word.length + 1 > wordLimit * 5) {
      // Approximate chunk size
      const lastPeriodIndex = currentChunk.lastIndexOf(".");
      if (lastPeriodIndex !== -1) {
        chunks.push(currentChunk.slice(0, lastPeriodIndex + 1).trim());
        currentChunk = currentChunk.slice(lastPeriodIndex + 1).trim();
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
    }
    currentChunk += (currentChunk ? " " : "") + word;
  });

  // Add remaining words to the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Function to process a single text chunk
async function processTextChunk(chunk, systemPromt, model_name) {
  const isStram = false;
  let result = null;
  let tries = 0;

  while (tries < 3) {
    try {
      result = await ShothikAIModel(
        chunk,
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

  // clean the response and store it to output
  let cleanedResponse = parseRevisedTexts(result);

  if (cleanedResponse.length === 0) {
    // call the function again
    let tryCount = 0;
    for (let i = 0; i < 10; i++) {
      cleanedResponse = parseRevisedTexts(result);
      tryCount++;

      result = await ShothikAIModel(
        chunk,
        modelRroute.humanize,
        isStram,
        null,
        systemPromt,
        "gemini-2.0-flash"
      );

      cleanedResponse = parseRevisedTexts(result);

      if (cleanedResponse.length > 0 && cleanedResponse.length > 1) {
        break;
      }
    }
  }

  // my array has two text string , so i need to add a new line to separate them
  const output = [];
  for (let i = 0; i < cleanedResponse.length; i++) {
    const score = Math.floor(Math.random() * (97 - 90 + 1)) + 90;

    if (
      cleanedResponse[i] &&
      cleanedResponse[i] !== undefined &&
      cleanedResponse[i] !== null
    ) {
      output.push({
        text: checkBlockListedWords(cleanedResponse[i]),
        score: score,
      });
    }
  }

  return output;
}

module.exports.humanizeModelV2 = async (req, res) => {
  try {
    const { text, level } = req.body;
    const modelName = req.body.model || "panda";

    if (!text || !level || !modelName) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

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
    const { wordLimit, model, todayWordUsed, totalWordLimit } =
      await PackagePermission(
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

    // ===========================================================

    // if word is less then 50 word then return error message
    if (inputWords < 30) {
      throw {
        message: `You can't use less than 30 words`,
        error: "WORD_COUNT_LIMIT_REQUEST",
      };
    }

    //========== Implement the logic for bypass here =============

    const texts = textArray(text, 100);

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
      systemPromt = systemInstruction;
    }

    if (modelName === "raven") {
      // systemPromt = systemInstructionRavenMmodel;
      systemPromt = systemInstruction;
    }

    // Process all text chunks concurrently
    const processedChunks = await Promise.all(
      texts.map((chunk) => processTextChunk(chunk, systemPromt, model_name))
    );

    // Combine the processed results
    const score = Math.floor(Math.random() * (97 - 90 + 1)) + 90;
    const output = mergeTexts(processedChunks).map((x) => {
      return {
        text: x.text,
        score: score,
      };
    });

    if (output.length == 0) {
      output = [
        { text: "Try Again !", score: 0 },
        { text: "Try Again !", score: 0 },
      ];
    }

    // save Usage
    await TrackUsage(req, {
      service: "bypass",
      word_count: String(text).split(" ").length,
      model: modelName,
    });

    saveHumanizdData(output, text, modelName, req, level);

    res.send({ result: output, success: true });
  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, "high", {}, "bypass", req.email);

    res.status(500).send({
      message: error.message,
      error: error.error,
    });
  }
};

const blockListedWords = [
  "sentence are substituted",
  "% of words",
  "substitution in sentences",
  "words substituted from",
  "words substituted",
  "(",
  "Class 6 and Class 8",
  ")",
];

// Check BlockListed words are in the Line if there then return empty string
function checkBlockListedWords(text) {
  const sentences = text.split(".");
  const filteredSentences = sentences.filter(
    (sentence) => !blockListedWords.some((word) => sentence.includes(word))
  );
  return filteredSentences.join(". ");
}

// Function to parse revised texts
function parseRevisedTexts(input) {
  // Split the input by "Revised Text" to find all instances
  const revisions = input.split("Revised Text");

  // Process each revision text
  const cleanedTexts = revisions
    .filter((text) => text.includes("):") || text.includes("**")) // Only keep sections that have revision text or '**'
    .map((text) => {
      // Extract the text after the colon
      const match = text.match(/\):([\s\S]*?)(?=\n\n|$)/);
      if (!match) return "";

      let cleanText = match[1]
        .replace(/\*([^*]+)\*/g, "$1") // Remove asterisks
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim(); // Remove leading/trailing whitespace

      // If the cleaned text is just '**', apply alternative formatting
      if (cleanText === "**") {
        cleanText = text
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\s+/g, " ")
          .trim();
      }

      return cleanText;
    })
    .filter((text) => text); // Remove empty strings

  // Remove all the * stars
  cleanedTexts.forEach((text, index) => {
    var cleanedText = text
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove ** formatting
      .replace(/\(Iteration [1-3]\):/g, ""); // Remove "(Iteration X):" prefixes

    cleanedText = String(cleanedText)
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    cleanedTexts[index] = cleanedText;
  });

  // REMOVE FIRST TEXT FROM THE ARRAY
  if (cleanedTexts.length > 0) {
    cleanedTexts.shift();
  }

  // REVERSE THE ARRAY
  cleanedTexts.reverse();
  return cleanedTexts;
}

// Function to save humanized data
async function saveHumanizdData(output, text, modelName, req, level) {
  let serial = 0;
  for (let each of output) {
    try {
      serial++;
      if (serial == 1) {
        const outputTxt = each?.text ?? "";
        const response = {
          before: text,
          after: outputTxt,
          level,
          score: each.score,
        };
        // save UsageLogs
        saveUsagesLogs(req.id, text, outputTxt, response, "bypass", modelName);
      }

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
        const data = await HumanizeUsesModel.create(payload);
        // console.log({ data });
      }
    } catch (error) {
      console.log(error);
    }
  }
}

function mergeTexts(textData) {
  // Error handling for invalid input
  if (!Array.isArray(textData)) {
    throw new Error("Input must be an array of text data.");
  }

  let result = [
    { text: "" }, // First index result
    { text: "" }, // Second index result
  ];

  for (const pair of textData) {
    // Check if the pair is a valid array with two objects
    if (!Array.isArray(pair) || pair.length !== 2) {
      continue; // Ignore invalid data
    }

    const [first, second] = pair;

    if (first?.text) {
      result[0].text += first.text.trim() + " "; // Concatenate first index text
    }

    if (second?.text) {
      result[1].text += second.text.trim() + " "; // Concatenate second index text
    }
  }

  // Trim concatenated text to remove trailing spaces
  result[0].text = result[0].text.trim();
  result[1].text = result[1].text.trim();

  return result;
}
