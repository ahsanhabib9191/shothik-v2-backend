const { VertexAI } = require("@google-cloud/vertexai");

// Initialize Vertex with your Cloud project and location
const vertex_ai = new VertexAI({
  project: "authentic-arch-428410-f5",
  location: "us-central1",
});

const model = "gemini-1.5-pro-002";

const path = require("path");
const { sendPusherToBanglaGrammer } = require("../lib/pusher");
const { removeEnclosedText } = require("../lib/trimmer");

// Instantiate the models

var tempre = 0.3;

async function generateContentGemini(
  content,
  conversationId,
  channel = "test",
  temparataure = tempre,
  output_token = 4000
) {
  const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
    generation_config: {
      max_output_tokens: output_token,
      temperature: temparataure,
      top_p: 1,
    },
    safety_settings: [],
  });

  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "service_account.json"
    );
    const req = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${content}.
      `,
            },
          ],
        },
      ],
    };

    const streamingResp = await generativeModel.generateContentStream(req);

    let data = "";

    for await (const item of streamingResp?.stream) {
      var parsedResponse = JSON.parse(JSON.stringify(item));
      for (let content of parsedResponse?.candidates) {
        for (let parts of content.content.parts) {
          var text = removeEnclosedText(parts?.text);
          sendPusherToBanglaGrammer(text, channel, conversationId);
          data += text;
        }
      }
    }

    return data;
  } catch (error) {
    console.log(error);
    return "অনেক বেশি রিকুয়েস্ট হওয়ার কারণে অনুগ্রহ করে কিছুক্ষন অপেক্ষা করুন। আপনার এই অনুরোধটি এখন প্রসেস করা হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।.";
  }
}

module.exports = {
  generateContentGemini,
};
