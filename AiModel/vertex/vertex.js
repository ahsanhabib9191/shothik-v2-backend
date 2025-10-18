const { VertexAI } = require("@google-cloud/vertexai");
const path = require("path");
const { locations } = require("../confiq");

// ---------- vertexai version 2 is implemented here ----------
const safety_settings = [
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "OFF",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "OFF",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "OFF",
  },
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "OFF",
  },
];

const shothikAiModel = (model, location, project, temparataure) => {
  const vertex_ai = new VertexAI({ project, location });
  const shothikAiModelConfig = {
    max_output_tokens: 10000,
    temperature: temparataure || 0.6,
    top_p: 0.9,
    top_k: 50,
  };

  const options = {
    model,
    generation_config: shothikAiModelConfig,
    safety_settings,
  };

  return vertex_ai.preview.getGenerativeModel(options);
};

let locationIndex = 0;

function getLocation() {
  console.log({ locationIndex });
  if (locationIndex >= locations.length) {
    locationIndex = 0;
  }

  const location = locations[locationIndex];

  locationIndex++;

  return location;
}

const AskVertexAI = async (propmt, stream, temparataure) => {
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "..",
      "..",
      "cred",
      "service_account.json"
    );

    let model = "gemini-2.0-flash-002";
    const project = "authentic-arch-428410-f5";
    let location = getLocation();

    const vertext = shothikAiModel(model, location, project, temparataure);

    const body = {
      contents: [{ role: "user", parts: [{ text: propmt }] }],
    };

    if (stream) {
      return vertext.generateContentStream(body);
    } else {
      const result = await vertext.generateContent(body);
      const output =
        result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      return output;
    }
  } catch (error) {
    console.error("Error invoking model:", error);
    throw error;
  }
};

module.exports = {
  AskVertexAI,
};
