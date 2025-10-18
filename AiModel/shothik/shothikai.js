const { AskAiStudio } = require("../aistudio/aistudio");
const { AskAwsAI } = require("../aws/aws");
const { AskVertexAI } = require("../vertex/vertex");

exports.ShothikAIModel = async (
  propmt,
  model = "aws",
  stream = false,
  temparataure = null,
  systemInstruction = undefined,
  model_name = "gemini-2.0-flash",
  history = undefined,
  generationConfig = null
) => {
  if (model === "vertex") {
    return await AskVertexAI(propmt, stream, temparataure);
  } else if (model === "aistudio") {
    return await AskAiStudio(
      propmt,
      stream,
      systemInstruction,
      model_name,
      history,
      generationConfig
    );
  } else {
    return await AskAwsAI(propmt);
  }
};
