const wordnet = require("wordnet");
const { Synonym } = require("../mongo/models/Synonym");

const axios = require("axios");
const { containsMaliciousText } = require("../lib/maliciousText");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { modelRroute } = require("../AiModel/confiq");

const synonymsController = async (req, res) => {
  const { word, sentence } = req.body;
  try {
    if (!word || !sentence) {
      return res
        .status(400)
        .json({ error: "BAD_REQUEST", message: "Required fields not present" });
    }

    // Prepare the prompt for Gemini model
    const prompt = `Provide 10 synonyms for the word "${word}". 
        Context: "${sentence}". 
        The output must follow this exact JSON format: ["word", "word", "word"]`;

    // Send request to shothik ai model
    const output = await ShothikAIModel(prompt, modelRroute.synonyms);

    // Check if the generated content contains malicious text
    const isContainMalicious = containsMaliciousText(output);

    if (isContainMalicious) {
      return res.json({
        content:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      });
    }

    // Attempt to parse the output as JSON for synonyms
    const synonyms = JSON.parse(
      output.replaceAll("```", "").replace("json", "")
    );

    // Save synonyms in the database
    saveSynonyms(word, synonyms);

    // Return the synonyms as response
    return res.json({ synonyms });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
};

// save synonyms in db
async function saveSynonyms(word, synonyms) {
  try {
    const synonym = new Synonym({
      word,
      synonyms,
    });
    await synonym.save();
    return true;
  } catch (error) {
    console.log(error);
  }
}

// Synonyms with third party library
const synonymsControllerV2 = async (req, res) => {
  const { word } = req.body;

  try {
    if (!word) {
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "Required word field not present",
      });
    }

    // Initialize WordNet
    await wordnet.init();

    // Fetch synonyms for the given word
    let definitions = await wordnet.lookup(word);
    let synonyms = [];

    if (!definitions || definitions.length === 0) {
      return res.status(404).json({ success: false, message: "No word found" });
    }

    // Extract synonyms from definitions
    definitions.forEach((def) => {
      def.meta.words.forEach((synonym) => {
        synonyms.push(synonym?.word);
      });
    });

    // Ensure unique synonyms
    synonyms = [...new Set(synonyms)];

    // Save synonyms in the database
    await saveSynonyms(word, synonyms);

    // Return the synonyms as response
    return res.json({ synonyms });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR", message: error.message });
  }
};
// Synonyms with Synonyms API CALL
const synonymsControllerV3 = async (req, res) => {
  const { token, next_token, is_phrase = false } = req.body;

  try {
    if (!token || !next_token) {
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "Required word and Next Word field not present",
      });
    }

    // fetch synonyms for the given token
    const { data } = await axios.post(
      `${process.env.SYNONYM_URL}/get_synnonyms`,
      {
        token,
        next_token,
        is_phrase,
      }
    );

    // Return the synonyms as response
    return res.json({ synonyms: data });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR", message: error.message });
  }
};
// Synonyms with Synonyms API CALL
const getSynonymsTokensV3 = async (req, res) => {
  const { text } = req.body;

  try {
    if (!text) {
      return res.status(400).json({
        error: "BAD_REQUEST",
        message: "Required Text field not present",
      });
    }

    // fetch synonyms for the given token
    const { data } = await axios.post(`${process.env.SYNONYM_URL}/get_tokens`, {
      text,
    });

    // Return the synonyms as response
    return res.json({ tokens: data });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR", message: error.message });
  }
};

module.exports = {
  synonymsController,
  synonymsControllerV2,
  synonymsControllerV3,
  getSynonymsTokensV3,
};

// const synonymsController = async (req, res) => {

//     try {
//         // Extract necessary data from the request
//         const { word, sentence } = req.body;

//         if (!word || !sentence) {
//           return res.status(400).json({ error: 'BAD_REQUEST', message: 'Required fields not present' });
//         }

//         try {
//           const configuration = await getOpenAIAPIConfiguration();
//           const openai = new OpenAIApi(configuration);

//           const prompt = `10 synonyms of "${word}".
//             Context : "${sentence}"
//             Must follow the example JSON output: ["word", "word", "word"]`;

//           const completion = await openai.createChatCompletion({
//             model: "gpt-4",
//             messages: [{
//               role: "user",
//               content: prompt,
//             }],
//           });

//           try {
//             const synonyms = JSON.parse(completion.data.choices[0].message.content);

//             // save synonyms in db
//             saveSynonyms(word, synonyms);

//             return res.json({ synonyms });
//           } catch (error) {
//             return { rawOutput: completion.data.choices[0].message.content };
//           }
//         } catch (error) {

//           return res.json({ message: 'Synonyms processed successfully' })

//         }

//        return res.json({ message: 'Synonyms processed successfully' });
//       } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error' });
//       }

// }
