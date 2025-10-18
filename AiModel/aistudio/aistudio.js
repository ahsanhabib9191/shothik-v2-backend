const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ChooseAPIKey } = require("./chooseAPIKey");

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

const config = {
  temperature: 1,
  topP: 0.95,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const AskAiStudio = async (
  prompt,
  stream,
  systemInstruction = undefined,
  modelName = null,
  history = undefined,
  generationConfig = config
) => {
  try {
    const apiKey = await ChooseAPIKey(modelName);
    console.log("[generationConfig]:", generationConfig);

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: modelName,
      safety_settings,
      systemInstruction,
    });

    const chatSession = model.startChat({ generationConfig, history });

    let result;

    if (stream) {
      result = chatSession.sendMessageStream(prompt);
    } else {
      const data = await chatSession.sendMessage(prompt);
      result = data.response.text();
    }

    return result;
  } catch (error) {
    console.error("Error in AskAiStudio:", error);

    throw {
      error: "MODEL_ERROR",
      message: "To Many Request, Please try again later",
    };
  }
};

module.exports = { AskAiStudio };
