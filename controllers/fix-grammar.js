const { getPromptByMode } = require("../lib/getPromtByMode");
const { TrackUsage } = require("../lib/TrackUsage");
const { saveUsagesLogs } = require("../mongo/models/UsageLogs");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const { PackagePermission } = require("../lib/PackagePermission");
const { containsMaliciousText } = require("../lib/maliciousText");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { modelRroute } = require("../AiModel/confiq");

async function FixGrammar(req, res) {
  try {
    const { data: text, language } = req.body;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!text || !language) {
      throw {
        error: "INVALID_ARGUMENT",
        message: "Required fields not present",
      };
    }

    // Check for malicious content in the paraphrased output
    const isContainMalicious = containsMaliciousText(text);
    if (isContainMalicious) {
      throw {
        error: "MALICIOUS_CONTENT",
        message:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      };
    }

    // Check if there are any limitations (such as API or word limits)
    const { wordLimit, totalWordLimit, todayWordUsed } =
      await PackagePermission(
        req.id,
        req.userIp,
        req.browserAgent,
        req.package,
        "grammar"
      );

    const inputWords = String(text)?.split(" ")?.length;
    const totalUsed = todayWordUsed + inputWords;

    if (totalUsed > totalWordLimit) {
      if (totalWordLimit !== 99999) {
        throw {
          success: false,
          message: "Grammar limit exceeded",
          error: "LIMIT_REQUEST",
        };
      }
    }
    if (inputWords > wordLimit) {
      throw {
        success: false,
        message: `You can't use more than ${wordLimit} words`,
        error: "LIMIT_REQUEST",
      };
    }

    const { prompt, temperature } = getPromptByMode("Fixed", text, language);

    const isStraming = true;
    let result = "";
    let tries = 0;

    // Retry up to 3 times
    while (tries < 3) {
      try {
        const streamingResp = await ShothikAIModel(
          prompt,
          modelRroute.grammar,
          isStraming,
          temperature
        );

        // Stream data to the client
        for await (const chunk of streamingResp.stream) {
          const text = chunk.text();
          result += text;
          res.write(text);
        }
        break; // Exit loop if successful
      } catch (error) {
        tries++;
        if (tries >= 3) {
          throw {
            error: "MODEL_ERROR",
            message: "Too Many Requests, Please try again later",
          };
        }
      }
    }

    // save database
    TrackUsage(req, {
      service: "grammar",
      word_count: String(text).split(" ").length,
    });

    // save UsageLogs
    if (req.user) {
      saveUsagesLogs(req.id, text, result, result, "grammar");
    }

    res.end();
  } catch (error) {
    const userEmail = req?.user?.email || "";
    saveErrorLog(error.message, "high", req.body, "grammar", userEmail);
    const statusCode = error.status || 500;
    console.log(error);

    res.status(statusCode).json({
      error: error.error || "UNKKNOWN_ERROR",
      message: error?.message,
    });
  }
}

async function FixGrammarWithVariant(req, res) {
  try {
    const { text, mode, synonym = "basic", language } = req.body;

    if (!text || !mode) {
      return res.status(400).json({
        error: "invalid-argument",
        message: "Required fields not present",
      });
    }

    const prompt = `I want you to act as a language detector and correct only the spelling and punctuation errors in ${language}. Generate 3 distinct paraphrased paragraphs that maintain the original meaning, but with improved spelling and punctuation. Ensure that the content is grammatically correct, and return the output as plain text. Do not include any additional explanations or headings. The content to be corrected is as follows: \n\n ${text}`;

    // shothik ai model
    const output = await ShothikAIModel(prompt, modelRroute.grammar);

    const reg = modelRroute.grammar === "aws" ? /\n/ : /\n\n/;

    const dta = output
      .split(reg)
      .map((sentence) => sentence.replace(/^\d+\.\s*/, "").trim());

    const after = dta.map((sentence) =>
      sentence.replace(/^\d+\.\s*/, "").trim()
    );

    const isContainMalicious = containsMaliciousText(dta.join(" "));
    if (isContainMalicious) {
      return res.json({
        content:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      });
    }

    // Construct the response content
    const content = {
      before: text,
      after,
      mode,
      synonym,
    };

    // Return output
    return res.json({ content });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "SERVER_ERROR", message: error.message });
  }
}

module.exports = { FixGrammar, FixGrammarWithVariant };
