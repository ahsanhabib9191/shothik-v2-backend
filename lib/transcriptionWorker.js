const { Worker } = require('bullmq');
const path = require('path');
const fs = require("fs");
const {Storage} = require("@google-cloud/storage");
const {CLOUD_BUCKET} = require("../config/constant");

const { redisConfig } = require('./Redis');
const { multiModel } = require('../vertext/vertext');
const { removeEnclosedText } = require('./trimmer');
const { meetingModel } = require('../vertext/vertextmeeting');
const { MeetingModel } = require('../mongo/models/meetingMinute');
const { convertVideoToMp3 } = require('../controllers/transcription.helper');
const storage = new Storage({
  keyFilename: path.join(__dirname, "..", "cred", "service_account.json"),
});

const bucket = storage.bucket(CLOUD_BUCKET)

// Worker for processing transcription jobs
const worker = new Worker('meeting-minute', async job => {
  const { uploadPath, ext, meetingId, userId } = job.data;

  try {
    await MeetingModel.findByIdAndUpdate(meetingId, { status: 'processing' });

    let mp3Path = uploadPath;
    if (['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'mpg', 'mpeg', '3gp', 'webm', 'wav'].includes(ext)) {
      await convertVideoToMp3(uploadPath, path.basename(uploadPath));
      mp3Path = uploadPath.replace(`.${ext}`, '.mp3');
    }

    // Upload the file to Google Cloud Storage
    const publicUrl = await uploadToGCS(mp3Path, ext);
    const transcriptionData = await TranscribeFileToText(publicUrl, 'mp3');
    // const cleanedTranscription = cleanTranscriptionData(transcriptionData);
    const meetingMinutes = await ConvertTextToMeeting(transcriptionData);

    await MeetingModel.findByIdAndUpdate(meetingId, {
      media: publicUrl,
      transcribeData: meetingMinutes,
      status: 'completed'
    });

    console.log(`Processing for job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    await MeetingModel.findByIdAndUpdate(meetingId, { status: 'failed' });
    throw error;
  }
}, {
  connection: redisConfig,
});

function isValidFileType(ext) {
  const supportedTypes = [
    "mp3",
    "wav",
    "ogg",
    "flac",
    "aac",
    "m4a",
    "opus",
    "webm",
    "mp4",
    "avi",
    "mkv",
    "mov",
    "wmv",
    "flv",
    "webm",
    "ogg",
    "ogv",
    "3gp",
    "3g2",
    "mpeg",
    "mpg",
    "m4v",
    "mov",
    "wmv",
  ];
  return supportedTypes.includes(ext.toLowerCase());
}

async function uploadToGCS(filePath, ext) {
  let uploadPath = filePath;
  let newName;
  let filename;
  let fileBuffer;

  // Convert video to MP3 if it's a video format
  if (["mp4", "mov", "avi", "mkv", "flv", "wmv", "mpg", "mpeg", "3gp", "webm", "wav"].includes(ext)) {
    console.log("Converting video to MP3...");
    await convertVideoToMp3(uploadPath, path.basename(uploadPath));
    uploadPath = uploadPath.replace(`.${ext}`, ".mp3");  // Replace file extension to .mp3 after conversion
    ext = "mp3";
  }

  // Generate a new file name based on the current timestamp
  newName = `${Date.now()}.${ext}`;
  filename = `uploads/${newName}`;
  const file = bucket.file(filename);

  // Read the file into a buffer
  fileBuffer = fs.readFileSync(uploadPath);

  // Upload the file to GCS
  await file.save(fileBuffer, {
    metadata: { contentType: `audio/${ext}` }, // Set correct content type
  });

  // Generate the public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
  console.log(`File uploaded successfully. Public URL: ${publicUrl}`);

  return publicUrl;
}

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

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.mp4':
      return 'video/mp4';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}


worker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed with ${err.message}`);
});

module.exports = worker;
