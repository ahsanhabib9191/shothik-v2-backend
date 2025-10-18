const { VertexAI } = require("@google-cloud/vertexai");
const { locations } = require("./config/config");
const path = require("path");

const MODEL_ID = "gemini-2.0-flash-exp";
const PROJECT_ID = "authentic-arch-428410-f5";
const LOCATION_ID = "us-central1";

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

const AskShothikAi = async (propmt, stream, temparataure) => {
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "..",
      "cred",
      "service_account.json"
    );

    let model = "gemini-2.0-flash-002";
    const project = "authentic-arch-428410-f5";
    let location = getLocation();

    console.log({ model, project, location });

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
    throw error;
  }
};

// Initialize Vertex with your Cloud project and location
const vertex_ai = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION_ID,
});

const generation_config = {
  max_output_tokens: 10000,
  temperature: 0.6,
  top_p: 0.9,
  top_k: 50,
};

// Instantiate the models
const generativeModel = vertex_ai.preview.getGenerativeModel({
  model: MODEL_ID,
  generation_config: generation_config,
  safety_settings: [],
});

// Variant the models
const variantModel = vertex_ai.preview.getGenerativeModel({
  model: MODEL_ID,
  generationConfig: {
    candidateCount: 1,
    maxOutputTokens: 2048,
    topP: 1,
  },
  safetySettings: [],
});

// MultiModel
// Instantiate the models
const multiModel = vertex_ai.preview.getGenerativeModel({
  model: MODEL_ID,
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 0.1,
    topP: 0.95,
  },
  safetySettings: [],
});

const API_ENDPOINT = "us-central1-aiplatform.googleapis.com";

module.exports = {
  generativeModel,
  multiModel,
  model: MODEL_ID,
  generation_config,
  API_ENDPOINT,
  PROJECT_ID,
  MODEL_ID,
  LOCATION_ID,
  variantModel,
  AskShothikAi,
};
