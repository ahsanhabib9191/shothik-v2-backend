const { AskAiStudio } = require("../AiModel/aistudio/aistudio");
const {
  ParaphraseSyncSentance,
  SynonymPhrase,
} = require("../mongo/paraphrase/ParaphraseSync");
const { ParaphraseSyncSystemPromt } = require("./prompts");

require("colors");

const EVENT_NAME = "paraphrase";

module.exports = function ParaphraseEvents(text) {
  console.log("GOT NEW EVENT : ", EVENT_NAME.bgRed.white);
  // console.log(text);

  const eachLines = text.split(".");

  eachLines.forEach((line) => {
    PostParaphraseEachLine(line);
  });
};

async function PostParaphraseEachLine(line) {
  try {
    console.log("GOT NEW LINE : ", String(line).bold.green);

    const modelName = "gemini-2.0-flash-8b";

    const result = await AskAiStudio(
      line,
      false,
      ParaphraseSyncSystemPromt,
      modelName,
      []
    );

    const parsedData = cleanAndFormatData(result);

    console.log("RESULT : ", parsedData);

    //    ParaphraseSyncSentance,
    //    SynonymPhrase

    console.log("=================>".white);
  } catch (error) {
    console.log(error);
  }
}

function cleanAndFormatData(data) {
  try {
    const input_data = String(data)
      .trim()
      .replace("```json", "")
      .replace("```", "");

    return JSON.parse(input_data);
  } catch (error) {
    return null;
  }
}
