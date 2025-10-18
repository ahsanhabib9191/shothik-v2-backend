const { VertexAI } = require("@google-cloud/vertexai");
const path = require("path");
// Initialize Vertex with your Cloud project and location
const vertex_ai = new VertexAI({
  project: "shothikai-gcp",
  location: "us-central1",
});
const model = "gemini-2.0-flash-002";

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  __dirname,
  "service_account.json"
);

// Instantiate the models
const generativeModel = vertex_ai.preview.getGenerativeModel({
  model: model,
  generationConfig: {
    maxOutputTokens: 8192,
    temperature: 1,
    topP: 0.95,
  },
  safetySettings: [
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
  ],
  systemInstruction: {
    parts: [{ text: `you are a text summarizer of 10 years experiance` }],
  },
});

// Function to generate content with proper error handling
async function VertexCall(inputText) {
  try {
    const req = {
      contents: [{ role: "user", parts: [{ text: inputText }] }],
    };

    const streamingResp = await generativeModel.generateContentStream(req);

    let finalOutput = "";

    for await (const item of streamingResp.stream) {
      // Check if there's content to append
      if (item.candidates && item.candidates[0].content.parts) {
        finalOutput += item.candidates[0].content.parts
          .map((part) => part.text)
          .join("");
      }
    }

    return finalOutput;
  } catch (error) {
    console.error("Error generating content:", error);
    return "An error occurred during content generation.";
  }
}

// Usage
VertexCall("I Love you").then((output) => console.log(output));

module.exports = {
  VertexCall,
};
