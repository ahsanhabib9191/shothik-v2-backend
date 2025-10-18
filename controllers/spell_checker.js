const axios = require("axios");
const { allowCors } = require("../lib/allowCors");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { modelRroute } = require("../AiModel/confiq");

// preprocess || Internal HELPER function
function prepare(text) {
  // Normalize and trim
  text = text.normalize("NFC").trim();
  // remove weird invisible characters
  text = text.replace(/\u200B|\u200C|\u200D/g, "");
  return text;
}

async function spellChecker(req, res) {
  const { content, language } = req.body;

  console.log("CONTENT", content);
  console.log("LANGUAGE", language);

  const input = prepare(content);

  // try {
  //   let result;

  //   // if (language === "Bengali") {
  //   //   result = await checkBengaliSpelling(content);
  //   // } else {
  // const data = await checkOtherLanguageSpelling(content, language);
  //     console.log(data, "spell checker");
  //     const str = data.replace(/'/g, '"');
  //     console.log(str, "after replace");
  //     result = JSON.parse(str);

  //   return res.json({ result });
  // } catch (error) {
  //   console.error("Error Occurred", error);
  //   return res
  //     .status(500)
  //     .json({ error: "An error occurred while processing your request." });
  // }

  let result;
  try {
    const data = await checkOtherLanguageSpelling(input, language);
    result = JSON.parse(data); // parse directly

    return res.json({ result });
  } catch (e) {
    console.error("Failed JSON.parse. Raw data:", data);

    // Fallback: extract words with regex if model misbehaves
    const matches = data.match(/"([^"]+)"/g);
    result = matches ? matches.map((w) => w.replace(/"/g, "")) : [];

    return res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
}

async function checkBengaliSpelling(content) {
  const trimmedContent = String(content).trim();
  const response = await axios.post(
    "https://api.spellcheck.bangla.gov.bd/checking",
    {
      service: "spell",
      content: trimmedContent || ".",
      maxSuggestionCount: 10,
      permissionToStoreData: true,
      client: 17,
      appVersion: "1.0.2",
      apiVersion: "2.1",
      userStoredData: {
        addToDictionaryTokens: [],
        ignoreAllTokens: [],
        ignoreOnceTokens: [],
      },
    },
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        Referer: "https://spell.bangla.gov.bd/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    }
  );

  return response.data;
}

async function checkOtherLanguageSpelling(content, language) {
  // const prompt = `
  //   Identify and return only the misspelled words from the provided text
  //   based on the ${language} dictionary.

  //   The output MUST be a valid JSON array of strings.
  //   Example format: ["word1", "word2", "word3"]
  //   No explanations, no extra text, only the JSON array.

  //   Input text: ${content}
  // `;

  //   const prompt = `
  //     Identify all misspelled words in the provided text based on the ${language} dictionary.
  //     For each misspelled word, return an object containing:
  //       - "error": the incorrect word exactly as it appears in the text
  //       - "correct": the most likely correct spelling suggestion

  //     The output MUST be a valid JSON array of objects in the following format:
  //     [
  //       { "error": "word_1", "correct": "correct_word_1" },
  //       { "error": "word_2", "correct": "correct_word_2" }
  //     ]

  //     Do not include any explanations, text, or formatting outside the JSON array.

  //     Input text: ${content}
  // `;

  const prompt = `
  Analyze the following text for grammar, spelling, and punctuation errors 
  based on standard ${language} grammar rules.

  Return a JSON object with:
  - "corrected": the full corrected version of the text.
  - "issues": an array of objects, each representing one correction, with:
      - "error": the exact text fragment that should be replaced.
      - "correct": the text that should replace it.

  The output MUST be valid JSON in this exact format:
  {
    "corrected": "This is the corrected sentence.",
    "issues": [
      { "error": "He go", "correct": "He goes" },
      { "error": "a apple", "correct": "an apple" }
    ]
  }

  Do not include any explanations, extra text, or formatting outside the JSON object.

  Input text: ${content}
`;

  const output = await ShothikAIModel(
    prompt,
    modelRroute.grammar,
    false,
    null,
    undefined,
    "gemini-2.5-flash",
    undefined,
    {
      temperature: 0,
      topP: 1,
    }
  );

  // Clean model formatting artifacts
  const cleaned = output.replaceAll("```", "").replace(/json/gi, "").trim();

  return cleaned;
}

module.exports = { spellChecker: allowCors(spellChecker) };
