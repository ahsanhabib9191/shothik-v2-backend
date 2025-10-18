const axios = require("axios");
const { allowCors } = require("../lib/allowCors");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { modelRroute } = require("../AiModel/confiq");
const GrammarModel = require("../mongo/models/Grammar");
const GrammarHistoryModel = require("../mongo/models/GrammarHistory");

// preprocess || Internal HELPER function
function prepare(text) {
  // Normalize and trim
  text = text.normalize("NFC").trim();
  // remove weird invisible characters
  text = text.replace(/\u200B|\u200C|\u200D/g, "");
  return text;
}

const grammarChecker = async (req, res) => {
  const { id, content, language } = req.body;
  const input = prepare(content);

  const buildPrompt = (content, language, isTitle, isScore) => `
    Analyze the following text for grammar, spelling, and punctuation errors 
    based on standard ${language ? language : "this language"} grammar rules.

    Return a JSON object with:
    ${isTitle ? `- "title": make a short title for the text to be title` : ""}
    - "corrected": the full corrected version of the text.
    - "issues": an array of objects, each representing one correction, with:
        - "error": the exact text fragment that should be replaced.
        - "correct": the text that should replace it.
        - "sentence": the sentence that contains the error.
        - "type": the type of error (e.g., grammar, punctuation, spelling).
    ${
      isScore
        ? `- "scores": an array of objects, each representing the accuracy of corrections for each type, with:
              - "type": one of "grammar", "spelling", "punctuation".
              - "score": a number between 0 and 100 representing how correct the text is for that type (100 = perfect).`
        : ""
    }
    

    The output MUST be valid JSON in this exact format:
    {
      ${isTitle ? `"title": "This is the title",` : ""}
      "corrected": "This is the corrected text.",
      "issues": [
        { "error": "He go", "correct": "He goes", "sentence": "He go to school", "type": "punctuation" },
        { "error": "a apple", "correct": "an apple", "sentence": "a apple is good for health", "type": "grammar" }
      ],
      ${
        isScore
          ? `"scores": [
              { "type": "grammar", "score": 100 },
              { "type": "spelling", "score": 100 },
              { "type": "punctuation", "score": 100 }
            ]`
          : ""
      }
    }

    Do not include any explanations, extra text, or formatting outside the JSON object.

    Input text: ${content}
  `;

  try {
    const output = await ShothikAIModel(
      buildPrompt(input, language, !id, true),
      modelRroute.grammar,
      false,
      null,
      undefined,
      "gemini-2.5-flash",
      undefined,
      { temperature: 0, topP: 1 }
    );

    const cleaned = output.replaceAll("```", "").replace(/json/gi, "").trim();
    const result = JSON.parse(cleaned);
    let grammar;
    let info;

    if (!id) {
      grammar = await GrammarModel.create({
        user: req.id,
        title: result?.title || "",
        text: input,
        language,
      });

      if (grammar?._id) {
        info = await GrammarHistoryModel.create({
          user: grammar?.user,
          grammar: grammar?._id,
          text: input,
          language: language,
          model: modelRroute?.grammar,
          result: result,
        });
      }
    } else {
      grammar = await GrammarModel.findById(id);

      if (grammar?._id) {
        info = await GrammarHistoryModel.create({
          user: grammar?.user,
          grammar: grammar?._id,
          text: input,
          language: language,
          model: modelRroute?.grammar,
          result: result,
        });
      }
    }

    return res.json({ success: true, result, grammar, info });
  } catch (e) {
    console.error("Failed JSON.parse. Raw data:", e.message);

    return res.status(500).json({
      error: "An error occurred while processing your request.",
      details: e.message,
    });
  }
};

const getGrammarSections = async (req, res) => {
  console.log("getGrammarSections");
  try {
    const userId = req.id;
    const { search = "", page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "No user id provided" });
    }

    // base query
    const query = { user: userId };

    // search filter (only title)
    if (search.trim()) {
      query.title = { $regex: search, $options: "i" };
    }

    const pageNum = Math.max(parseInt(page), 1);
    const pageSize = Math.max(parseInt(limit), 1);
    const skip = (pageNum - 1) * pageSize;

    // total count for pagination
    const total = await GrammarModel.countDocuments(query);

    // get sections
    const sections = await GrammarModel.find(query)
      .select("_id timestamp user title text language")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    if (!sections || sections.length === 0) {
      return res.status(404).json({ message: "No file sections found" });
    }

    return res.status(200).json({
      data: sections,
      meta: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching file sections:", error);
    return res.status(500).json({ error: "Failed to fetch file sections" });
  }
};

const getGrammarSection = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "No user id provided" });
    }

    if (!id) {
      return res.status(400).json({ error: "No section id provided" });
    }

    const section = await GrammarModel.findOne({
      _id: id,
      user: userId,
    }).lean();

    if (!section) {
      return res
        .status(404)
        .json({ error: "File section not found or not owned by user" });
    }

    return res.status(200).json({ success: true, data: section });
  } catch (error) {
    console.error("Error fetching file section:", error);
    return res.status(500).json({ error: "Failed to fetch file section" });
  }
};

const grammarSectionRename = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    const { title } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "No user id provided" });
    }

    if (!id) {
      return res.status(400).json({ error: "No section id provided" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "New title is required" });
    }

    // update only if the fa belongs to the user
    const updated = await GrammarModel.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { title: title.trim() } },
      { new: true, select: "_id title timestamp" }
    ).lean();

    if (!updated) {
      return res
        .status(404)
        .json({ error: "File section not found or not owned by user" });
    }

    return res.status(200).json({
      message: "Title updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error renaming file section:", error);
    return res.status(500).json({ error: "Failed to rename file section" });
  }
};

const grammarSectionDelete = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "No user id provided" });
    }

    if (!id) {
      return res.status(400).json({ error: "No file id provided" });
    }

    const deleted = await GrammarModel.findOneAndDelete({
      _id: id,
      user: userId,
    }).lean();

    if (!deleted) {
      return res
        .status(404)
        .json({ error: "File not found or not owned by user" });
    }

    return res.status(200).json({
      message: "File deleted successfully",
      data: {
        _id: deleted._id,
        title: deleted.title,
      },
    });
  } catch (error) {
    console.error("Error deleting sections:", error);
    return res.status(500).json({ error: "Failed to delete file" });
  }
};

module.exports = {
  grammarChecker: allowCors(grammarChecker),
  getGrammarSections: allowCors(getGrammarSections),
  getGrammarSection: allowCors(getGrammarSection),
  grammarSectionRename: allowCors(grammarSectionRename),
  grammarSectionDelete: allowCors(grammarSectionDelete),
};
