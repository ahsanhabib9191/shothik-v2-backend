const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GeminiAPIkeys } = require("../mongo/models/geminiAPIkeys");
const { systemInstruction } = require("../AiModel/confiq");

const systemInstruction = systemInstruction;

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function getApiKey() {
  const token = await GeminiAPIkeys.findOne({ status: "active" }).sort({
    keyIndex: -1,
  });
  if (!token) {
    await GeminiAPIkeys.updateMany({}, { status: "active" });
    return getApiKey();
  }
  return token;
}

const AskShothikHumanModel = async (texts, res) => {
  try {
    const token = await getApiKey();

    const genAI = new GoogleGenerativeAI(token.apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction,
    });

    const chatSession = model.startChat({ generationConfig });
    const result = await chatSession.sendMessage(texts);

    //update api key status
    await GeminiAPIkeys.updateOne(
      { apiKey: token.apiKey },
      {
        $set: { status: "inactive" },
        $inc: { totalUsed: 1 },
      }
    );

    return result.response.text();
  } catch (error) {
    throw {
      error: "unknown",
      message:
        "The server is currently unable to handle your request. Please try again later.",
    };
  }
};

module.exports = { AskShothikHumanModel };
