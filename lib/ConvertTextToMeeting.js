const path = require('path');
const { meetingModel } = require("../vertext/vertextmeeting");
const { removeEnclosedText } = require("./trimmer");

async function ConvertTextToMeeting(cleanedTranscribeData) {
  console.log("Meeting generate function started");

  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
    __dirname,
    "..",
    "cred",
    "service_account.json"
  );

  const req = {
    contents: [{role: "user", parts: [{text: `${cleanedTranscribeData}`}]}],
  };

  console.log("Sending request to meetingModel.generateContentStream");
  const streamingResp = await meetingModel.generateContentStream(req);

  let data = "";
  for await (const item of streamingResp?.stream) {
    var parsedResponse = JSON.parse(JSON.stringify(item));
    for (let content of parsedResponse?.candidates) {
      for (let parts of content.content.parts) {
        var text = removeEnclosedText(parts?.text);
        data += text;
      }
    }
  }
  console.log("Converted meeting");

  return {
    data,
  };
}

module.exports = {
    ConvertTextToMeeting
}