const path = require("path");
const fs = require("fs");
const { multiModel } = require("../vertext/vertext");
const { meetingModel } = require("../vertext/vertextmeeting");
const { removeEnclosedText } = require("./trimmer");

async function TranscribeFileToText(filename, ext) {
  console.log("TranscribeFileToText function started");

  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
    __dirname,
    "..",
    "cred",
    "service_account.json"
  );

  let mimeType = null;
  switch (ext) {
    case "mp3":
      mimeType = "audio/mpeg";
      break;
    case "wav":
      mimeType = "audio/wav";
      break;
    case "ogg":
      mimeType = "audio/ogg";
      break;
    case "flac":
      mimeType = "audio/flac";
      break;
    case "aac":
      mimeType = "audio/aac";
      break;
    case "m4a":
      mimeType = "audio/mp4";
      break;
    case "opus":
      mimeType = "audio/opus";
      break;
    case "webm":
      mimeType = "audio/webm";
      break;
    case "mp4":
      mimeType = "video/mp4";
      break;
    case "avi":
      mimeType = "video/x-msvideo";
      break;
    case "mkv":
      mimeType = "video/x-matroska";
      break;
    case "mov":
      mimeType = "video/quicktime";
      break;
    case "wmv":
      mimeType = "video/x-ms-wmv";
      break;
    case "flv":
      mimeType = "video/x-flv";
      break;
    case "webm":
      mimeType = "video/webm";
      break;
    case "ogg":
      mimeType = "video/ogg";
      break;
    case "ogv":
      mimeType = "video/ogg";
      break;
    case "3gp":
      mimeType = "video/3gpp";
      break;
    case "3g2":
      mimeType = "video/3gpp2";
      break;
    case "mpeg":
      mimeType = "video/mpeg";
      break;
    case "mpg":
      mimeType = "video/mpeg";
      break;
    case "m4v":
      mimeType = "video/x-m4v";
      break;
    case "mov":
      mimeType = "video/quicktime";
      break;
    case "wmv":
      mimeType = "video/x-ms-wmv";
      break;
    default:
      mimeType = "application/octet-stream";
  }

  console.log(`MimeType for extension ${ext}: ${mimeType}`);

  const video1 = {
    fileData: {
      mimeType: mimeType,
      fileUri: `gs://shothik/${filename}`,
    },
  };

  const req = {
    contents: [
      {
        role: "user",
        parts: [
          video1,
          {
            text: `Transcribe the file's text. Please transcribe directly without adding any extra words or suggestions; keep it straightforward and precise.`,
          },
        ],
      },
    ],
  };

  console.log("Sending request to multiModel.generateContentStream");
  const streamingResp = await multiModel.generateContentStream(req);

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

  console.log("Transcription data received");

  return {
    data,
  };
}

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

module.exports={
  TranscribeFileToText,
  ConvertTextToMeeting,
}