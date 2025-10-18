require("dotenv").config({});
const { VertexAI } = require("@google-cloud/vertexai");

// Initialize Vertex with your Cloud project and location
const vertex_ai = new VertexAI({
  project: "authentic-arch-428410-f5",
  location: "us-central1",
});

const model = "gemini-1.5-pro-002";
const path = require("path");
const { sendMessage } = require("../lib/pusher");
const { getOpenAIAPIConfiguration } = require("../controllers");
const { OpenAIApi } = require("openai");

// Instantiate the models
const generativeModel = vertex_ai.preview.getGenerativeModel({
  model: model,
  generation_config: {
    max_output_tokens: 2048,
    temperature: 0.9,
    top_p: 1,
  },
  safety_settings: [],
});

async function generateContent(content) {
  console.log("Working...");
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
            text: `format and check grammer  correct sentence in Bangla. Abstract: ${content}.
    `,
          },
        ],
      },
    ],
  };

  const streamingResp = await generativeModel.generateContentStream(req);

  for await (const item of streamingResp?.stream) {
    var parsedResponse = JSON.parse(JSON.stringify(item));
    for (let content of parsedResponse?.candidates) {
      for (let parts of content.content.parts) {
        sendMessage("test", "test", { data: parts?.text });
        process.stdout.write("stream chunk: " + parts?.text);
      }
    }
  }
  //   const data = await streamingResp.response;
  return "data";
}

async function generateMeetingKeynote(content) {
  try {
    console.log("Working...");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "service_account.json"
    );

    const prompt = `You are an expert summarizer with over 50 years of experience.
    From now on, when you receive the transcription of a meeting, respond by creating a summary with the key points in Bengali of the meeting following this template, but also using your experience:
    
    1. Title: Include the title of the meeting
    2. Date: Include the date on which the meeting took place.
    3. Participants: Specify the main participants in the meeting, such as the president, speakers, and important group members.
    4. Agenda Discussion: Highlight the key points of the agenda, such as the approval of the agenda, proposed resolutions, or issues addressed and for each point indicate the key decisions taken during the meeting, including voting results and approved resolutions.
    5. Results and Future Actions: Specify future planned actions or commitments made during the meeting to address the discussed topics.
    6. Conclusions: Offer a concise conclusion that summarizes the overall flow of the meeting and highlights any important matters that require further actions or future discussions.
    7. Next Meeting: If applicable, indicate the date and time of the next meeting to keep participants informed.
    8. Any Open Issues: Report any unresolved issues or problems that require further discussions or actions.
    
    Use bold characters for every point. \n
    Input : ${content}`;

    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "service_account.json"
    );

    const req = {
      contents: [{ role: "user", parts: [{ text: `${prompt}` }] }],
    };

    const streamingResp = await generativeModel.generateContentStream(req);

    let data = "";
    for await (const item of streamingResp?.stream) {
      var parsedResponse = JSON.parse(JSON.stringify(item));
      for (let content of parsedResponse?.candidates) {
        for (let parts of content.content.parts) {
          data += parts?.text;
          // process.stdout.write('stream chunk: ' + );
        }
      }
    }

    return data;
  } catch (error) {
    console.log(error);
    return "Please wait ! we are working on generating the keynote for you.";
  }
}

// generateMeetingKeynote('আমার সোনার বাংলা আমি তোমায় ভালোবাসি');

module.exports = {
  generateContent,
  generateMeetingKeynote,
};
