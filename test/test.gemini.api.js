const { GoogleGenerativeAI } = require("@google/generative-ai");

async function isGeminiWorking(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
  });
  
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };
  
  try {
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });
  
    await chatSession.sendMessage("Hello");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}


module.exports = {
    isGeminiWorking
}