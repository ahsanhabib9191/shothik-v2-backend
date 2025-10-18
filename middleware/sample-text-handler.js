const {
  checkIfSampleText,
  paraphrase_sample_text_standard,
  paraphrase_sample_text_fluency,
  paraphrase_sample_text,
  paraphrase_sample_text_standard_reprase,
  paraphrase_sample_text_fluency_reprase,
  sample_text_for_paraphrase_with_variation,
  ai_ditector_sample_text,
  fixgrammar_sample_text,
  fixgrammar_sample_text_result,
  summarize_sample_text,
  summerize_sample_text_keysentence_result,
  summarize_sample_text_paraphrap_result,
} = require("../data/sample-text");

// Paraphrase Sample Text Handler
const HumanizeSampleTextHandler = async (req, res, next) => {
  try {
    const { text } = req.body;
    const isSampleText = checkIfSampleText(text);
    if (isSampleText) {
      // await for 1 sec before sending the response
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.json({
        output: isSampleText,
        success: true,
      });
    }
    // otherwise continue with the request
    next();
  } catch (error) {
    next();
  }
};

const paraphraseSampleTextHandler = async (req, res, next) => {
  try {
    const { text, mode } = req.body;

    let sampleText =
      mode === "standard"
        ? paraphrase_sample_text_standard
        : paraphrase_sample_text_fluency;

    const rephraseSampleText =
      mode === "standard"
        ? paraphrase_sample_text_standard_reprase
        : paraphrase_sample_text_fluency_reprase;

    let isSampleText =
      paraphrase_sample_text.toLowerCase() === text.trim().toLowerCase();

    if (!isSampleText) {
      isSampleText = sampleText.toLowerCase() === text.trim().toLowerCase();
      sampleText = rephraseSampleText;
    }

    if (isSampleText) {
      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(sampleText);
      res.end();

      return;
    }
    // otherwise continue with the request
    next();
  } catch (error) {
    next(error);
  }
};

const summerizeSampleTextHandler = async (req, res, next) => {
  try {
    const { text, mode } = req.body;
    const result =
      mode === "Key Sentences"
        ? summerize_sample_text_keysentence_result
        : summarize_sample_text_paraphrap_result;

    let isSampleText = summarize_sample_text === text.trim();

    if (isSampleText) {
      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(result);
      res.end();

      return;
    }
    // otherwise continue with the request
    next();
  } catch (error) {
    next(error);
  }
};
const fixGrammarSampleTextHandler = async (req, res, next) => {
  try {
    const { data: text } = req.body;

    let isSampleText = fixgrammar_sample_text === text.trim();

    if (isSampleText) {
      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(fixgrammar_sample_text_result);
      res.end();

      return;
    }
    // otherwise continue with the request
    next();
  } catch (error) {
    next(error);
  }
};

const rephraseSampleTexthandler = async (req, res, next) => {
  try {
    const { text, mode } = req.body;
    const sampleText = sample_text_for_paraphrase_with_variation;
    let haveSampleText = sampleText.find(
      (item) => item.sentence === text.trim()
    );
    if (haveSampleText) {
      haveSampleText = haveSampleText[mode];
    }

    if (haveSampleText) {
      const content = {
        before: text,
        after: haveSampleText,
        mode,
        synonym: "basic",
      };
      return res.send({ content });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const aiDitectorSampleText = async (req, res, next) => {
  try {
    const { text } = req.body;
    const isSampleText = ai_ditector_sample_text.find(
      (item) => item.text === text.trim()
    );
    if (isSampleText) {
      // await for 1 sec before sending the response
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.json({
        result: isSampleText.result,
        success: true,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
const aiDitectorSampleTextForShare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isSampleText = ai_ditector_sample_text.find(
      (item) => item.result._id === id
    );

    if (isSampleText) {
      // await for 1 sec before sending the response
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.json({
        result: isSampleText.result,
        success: true,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  HumanizeSampleTextHandler,
  paraphraseSampleTextHandler,
  rephraseSampleTexthandler,
  aiDitectorSampleText,
  aiDitectorSampleTextForShare,
  fixGrammarSampleTextHandler,
  summerizeSampleTextHandler,
};
