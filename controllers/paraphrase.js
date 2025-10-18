const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { modelRroute, paraphraseInstruction } = require("../AiModel/confiq");
const { trackUserData } = require("../lib/trackuserData");
const { PackagePermission } = require("../lib/PackagePermission");
const { containsMaliciousText } = require("../lib/maliciousText");
const { redis } = require("../lib/Redis");

const paraphraseControllerWithVariant = async (req, res) => {
  try {
    const data = req.body;
    const { text, mode, synonym = "basic", language } = data;

    if (!text || !mode) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

    // Check API usage limits
    const { modes } = await PackagePermission(
      req.id,
      req.userIp,
      req.browserAgent,
      req.package,
      "paraphrase"
    );

    if (!modes.includes(mode)) {
      throw {
        message: `You can't use this mode`,
        error: "LIMIT_REQUEST",
      };
    }

    const prompt = `Paraphrase the following content in ${mode} mode with ${synonym} level synonyms in ${language}. Generate 3 distinct paragraphs of paraphrased content. Each paragraph should convey the same meaning as the original, but with varied structure, vocabulary, and expression. The output must only contain the paraphrased paragraphs without any labels, headings, or extra words. The content to be paraphrased is as follows: \n\n ${text}.`;

    // shothik ai model
    const output = await ShothikAIModel(prompt, modelRroute.paraphrase);

    const reg = modelRroute.paraphrase === "aws" ? /\n/ : /\n\n/;

    const after = output
      .split(reg)
      .map((sentence) => sentence.replace(/^\d+\.\s*/, "").trim());

    const isContainMalicious = containsMaliciousText(after.join(" "));
    if (isContainMalicious) {
      throw {
        errror: "MELICIOUS_CONTENT",
        message:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      };
    }

    // save paraphrase result
    const content = {
      before: text,
      after,
      mode,
      synonym,
    };

    res.send({ content });
  } catch (error) {
    console.log("error", error);
    saveErrorLog(error.message, "high", {}, "paraphrase");
    res.status(500).send({ error: error.error, message: error.message });
  }
};

const paraphraseController = async (req, res) => {
  try {
    const data = req.body;
    const { text, mode, synonym = "basic", freeze, language } = data;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const options = {
      input: text,
      mode,
      synonym,
    };

    let systemInstruction = "";
    let synonumLavel = "";

    if (synonym === "basic") {
      synonumLavel = "Fewer change";
    } else if (synonym === "intermediate") {
      synonumLavel = "Fewer change";
    } else if (synonym === "advanced") {
      synonumLavel = "More change";
    } else if (synonym === "expert") {
      synonumLavel = "Max change";
    }

    if (mode === "standard") {
      systemInstruction = paraphraseInstruction.standard(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "fluency") {
      systemInstruction = paraphraseInstruction.fluency(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "formal") {
      systemInstruction = paraphraseInstruction.formal(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "academic") {
      systemInstruction = paraphraseInstruction.academic(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "news") {
      systemInstruction = paraphraseInstruction.news(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "simple") {
      systemInstruction = paraphraseInstruction.simple(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "creative") {
      systemInstruction = paraphraseInstruction.creative(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "short") {
      systemInstruction = paraphraseInstruction.short(
        synonumLavel,
        freeze,
        language
      );
    } else if (mode === "long") {
      systemInstruction = paraphraseInstruction.expand(
        synonumLavel,
        freeze,
        language
      );
    }

    // shothik ai model
    const isStraming = true;

    let output = "";
    let tries = 0;
    while (tries < 3) {
      try {
        const streamingResp = await ShothikAIModel(
          text,
          modelRroute.paraphrase,
          isStraming,
          1,
          systemInstruction,
          "gemini-2.0-flash"
        );

        for await (const chunk of streamingResp.stream) {
          const text = chunk.text();
          output += text;
          res.write(text);
        }

        break;
      } catch (error) {
        tries++;
        console.log("Error from shothik model", error);
      }
    }

    options.output = output;
    await trackUserData(req, "paraphrase", options);

    res.end();
  } catch (error) {
    saveErrorLog(error.message, "high", {}, "paraphrase", req.email);

    const statusCode = error.status || 500;

    res.status(statusCode).json({
      error: error.error,
      message: "Please Try again",
    });
  }
};

module.exports = {
  paraphraseController,
  paraphraseControllerWithVariant,
};
