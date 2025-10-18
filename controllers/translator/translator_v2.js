const { PackagePermission } = require("../../lib/PackagePermission");
const { TrackUsage } = require("../../lib/TrackUsage");
const { saveUsagesLogs } = require("../../mongo/models/UsageLogs");
const { saveErrorLog } = require("../../mongo/models/ErrorLogs");

const { containsMaliciousText } = require("../../lib/maliciousText");
const { ShothikAIModel } = require("../../AiModel/shothik/shothikai");
const { modelRroute } = require("../../AiModel/confiq");

async function translator_v2(req, res) {
  try {
    const { data: text, direction } = req.body;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!text) {
      throw { message: `Request is invalid` };
    }

    const FromLang = String(direction).toLowerCase().split("to")[0];
    const ToLang = String(direction).toLowerCase().split("to")[1];

    if (!FromLang || !ToLang) {
      throw { message: `Request is invalid` };
    }

    const isContainMalicious = containsMaliciousText(text);
    if (isContainMalicious) {
      throw {
        error: "MALICIOUS_CONTENT",
        message:
          "Thank you for using SHOTHIK AI. I am SHOTHIK,  Developed by SHOTHIK AI TEAM",
      };
    }

    // ========== Check useage api hit and word limit permission========
    const { wordLimit, todayWordUsed, totalWordLimit } =
      await PackagePermission(
        req.id,
        req.userIp,
        req.browserAgent,
        req.package,
        "translator"
      );

    const inputWords = String(text)?.split(" ")?.length;
    const totalUsed = todayWordUsed + inputWords;

    // check api limit
    if (totalUsed > totalWordLimit) {
      if (totalWordLimit !== 99999) {
        throw {
          message: "Translation limit exceeded",
          error: "LIMIT_REQUEST",
        };
      }
    }
    // check word limit
    if (inputWords > wordLimit) {
      throw {
        message: `You can't use more than ${wordLimit} word`,
        error: "LIMIT_REQUEST",
      };
    }

    const promt = `i want you to act as a translator. i am giving a text in ${FromLang} language, and translate it ${ToLang} language. Please do not  provide any further explanations and unwanted text. given text is : "${text}".`;

    const isStrem = true;
    let output = "";
    let tries = 0;
    while (tries < 3) {
      try {
        const streamingResp = await ShothikAIModel(
          promt,
          modelRroute.translator,
          isStrem
        );

        // Stream data to the client
        for await (const chunk of streamingResp.stream) {
          const text = chunk.text();
          output += text;
          res.write(text);
        }
        break;
      } catch (error) {
        tries++;
        if (tries >= 3) {
          throw {
            error: "MODEL_ERROR",
            message: "To Many Request, Please try again later",
          };
        }
      }
    }

    // save Usage
    TrackUsage(req, {
      service: "translator",
      word_count: String(output).split(" ").length,
    });

    // save UsageLogs
    if (req.user) {
      saveUsagesLogs(req.id, req.body, "", output, "translator");
    }

    res.end();
  } catch (error) {
    console.log(error);
    const userEmail = req?.user?.email || "";
    saveErrorLog(error.message, "high", req.body, "translator", userEmail);

    const statusCode = error.status || 500;

    res.status(statusCode).json({
      error: error.error || "UNKKNOWN_ERROR",
      message: error.message,
    });
  }
}

module.exports = { translator_v2 };
