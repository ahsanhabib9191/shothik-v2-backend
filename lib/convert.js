const { Storage } = require("@google-cloud/storage");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");
const ffprobe = require("ffprobe");
const ffprobeStatic = require("ffprobe-static");

if (os.platform() === "win32") {
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log("Using ffmpeg from @ffmpeg-installer on Windows");
} else {
  ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
  console.log("Using system-installed ffmpeg on Linux/Docker");
}

const { multiModel } = require("../vertext/vertext");
const { removeEnclosedText, cleanString } = require("./trimmer");
const {
  meetingModel,
  createMeetingModel,
  summaryModel,
} = require("../vertext/vertextmeeting");
const { CLOUD_BUCKET } = require("../config/constant");
const { MeetingModel } = require("../mongo/models/meetingMinute");
const { sendMessageToRoom } = require("../services/socketService");

const storage = new Storage({
  keyFilename: path.join(__dirname, "..", "cred", "service_account.json"),
});

const bucket = storage.bucket(CLOUD_BUCKET);

async function convertLargeVideoToMp3(filepath) {
  return new Promise((resolve, reject) => {
    const mp3Filename = filepath.replace(/\.[^/.]+$/, ".mp3");
    ffmpeg(filepath)
      .toFormat("mp3")
      .on("end", () => resolve(mp3Filename))
      .on("error", (err) => reject(err))
      .save(mp3Filename);
  });
}

async function convertAudioToMp3(filepath) {
  return convertLargeVideoToMp3(filepath);
}

async function uploadFileToGcs(directory, mp3FilePath) {
  try {
    let filename = path.basename(mp3FilePath);
    if (filename.includes("uploads/")) {
      filename = filename.replace("uploads/", "");
    }

    console.log(`Found File to Upload ${filename}`);
    const maxRetries = 5;
    let delay = 5000; // Initial delay in milliseconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const duration = await getAudioDuration(mp3FilePath);

        console.log("Uploading file ...", filename);
        const gcsFilePath = `${directory}/${filename}`;
        const localFilePath = path.join(__dirname, "..", "uploads", filename);

        // Upload the file to GCS using bucket.upload()
        await bucket.upload(localFilePath, {
          destination: gcsFilePath,
        });

        const fileUrl = `gs://${CLOUD_BUCKET}/${gcsFilePath}`;
        const publicUrl = `https://storage.googleapis.com/${CLOUD_BUCKET}/${gcsFilePath}`;
        console.log(`File uploaded to: ${fileUrl}`);
        console.log(`Public uploaded to: ${publicUrl}`);
        return { fileUrl, publicUrl, duration };
      } catch (e) {
        console.log(
          `Error uploading file to GCS: ${e}. Retrying in ${delay} ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff for retries
      }
    }
    throw new Error("Max retries exceeded for uploading to GCS.");
  } catch (e) {
    console.log(`Error uploading file to GCS: ${e}`);
    throw e;
  }
}

async function generateSignedUrl(gcsUri, expirationTime = 3600000) {
  try {
    const storage = new Storage();
    const [bucketName, filePath] = gcsUri.replace("gs://", "").split("/", 2);
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expirationTime,
    });

    console.log(`Generated signed URL: ${signedUrl}`);
    return signedUrl;
  } catch (e) {
    console.log(`Error generating signed URL: ${e}`);
    throw e;
  }
}

async function downloadFromGcs(gcsUri, localDestination) {
  console.log(`Downloading ${gcsUri} to ${localDestination} ...`);
  const [bucketName, filePath] = gcsUri.replace("gs://", "").split("/", 2);
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  await file.download({ destination: localDestination });
  console.log(`Downloaded ${gcsUri} to ${localDestination}`);
}

async function transcribeAudioWithChunking(localFilePath, language, meetingId) {
  try {
    const fileName = path.basename(localFilePath, path.extname(localFilePath));
    console.log(`Transcribe file: ${fileName} in ${language}`);

    const chunkDuration = 300; // 5 minutes (600 seconds)
    let fullTranscript = "";

    // Create 'chunks' folder if it doesn't exist
    const chunksDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
      console.log(`Created directory: ${chunksDir}`);
    }

    // Use ffmpeg to get the duration of the audio
    const audioDuration = await getAudioDuration(localFilePath);

    for (
      let startTime = 0;
      startTime < audioDuration;
      startTime += chunkDuration
    ) {
      const endTime = Math.min(startTime + chunkDuration, audioDuration);
      const chunkFilename = `${fileName}_${startTime}_${endTime}.mp3`;
      const chunkPath = path.join(chunksDir, chunkFilename);

      // Split the audio into chunks using ffmpeg
      await splitAudio(localFilePath, chunkPath, startTime, endTime);
      console.log(`Chunking Done for: ${chunkPath}`);

      // Upload the chunk to GCS
      const { fileUrl: chunkUrl } = await uploadFileToGcs("uploads", chunkPath, 'processing');

       const progress = ((endTime / audioDuration) * 100).toFixed(0);

      console.log(`Uploaded Progress: ${progress}`);
      sendMessageToRoom(meetingId, "meetingMinute", `Processing file: ${progress}%`, 'processing');

      // Throttle requests to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Transcribe the chunk
      const chunkTranscript = await transcribeChunk(chunkUrl, language, meetingId, chunkFilename);
      fullTranscript += chunkTranscript + " ";

    }

    return fullTranscript.trim();
  } catch (e) {
    console.log(`Error in transcribeAudioWithChunking: ${e.message}`);
    await MeetingModel.findByIdAndUpdate(meetingId, {
			status: "failed",
			errorMessage: 'Failed to transcribe the audio file. Ensure the file format and quality meet the transcription requirements.',
		});
    throw e;
  }
}

const getAudioDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffprobe(filePath, { path: ffprobeStatic.path }, (err, info) => {
      if (err) return reject(err);
      //   const sizeInBytes = fs.statSync(filePath).size
      const durationInSeconds = info.streams[0].duration;
      console.log("Chunk duration =========> ", durationInSeconds);
      resolve(durationInSeconds);
    });
  });
};

// Function to split audio using ffmpeg
async function splitAudio(inputPath, outputPath, startTime, endTime) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .output(outputPath)
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        reject(`Error splitting audio: ${err.message}`);
      })
      .run();
  });
}

async function transcribeChunk(fileUrl, language, meetingId, chunkFilename) {
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "..",
      "cred",
      "service_account.json"
    );

    console.log(`Transcribing chunk: ${chunkFilename}`);
    // sendMessageToRoom(meetingId, "meetingMinute", `Transcribing chunk: ${chunkFilename}`, 'processing');

    const transcriptionPrompt = `Transcribe the file to ${language} . Do not give any extra text.`;

    const video1 = {
      fileData: {
        mimeType: "audio/mpeg",
        fileUri: `${fileUrl}`,
      },
    };

    const req = {
      contents: [
        {
          role: "user",
          parts: [
            video1,
            {
              text: transcriptionPrompt,
            },
          ],
        },
      ],
    };

    console.log("Sending request to Transcribe Model");
    // sendMessageToRoom(meetingId, "meetingMinute", `Sending request to Transcribe Model`, 'processing');
    const result = await multiModel.generateContent(req);
    const output = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    const data = cleanString(output)

    console.log("Transcription completed");
    // sendMessageToRoom(meetingId, "meetingMinute", `Transcription Completed: ${progress}`, 'processing');

    return data;
  } catch (e) {
    console.log(`Error in transcribeChunk: ${e}`);
    await MeetingModel.findByIdAndUpdate(meetingId, {
      status: "failed",
      errorMessage: 'Failed to transcribe from audio, please check your audio',
    });

    sendMessageToRoom(meetingId, "meetingMinute", `Failed to transcribe from audio, please check your audio`, 'failed');
    throw e;
  }
}

async function summarizeTranscriptWithVertex(transcript, meetingId) {
  const maxRetries = 5;
  const baseDelay = 15000;
  const maxDelay = 300000;

  const wordCount = transcript.split(/\s+/).length;
  console.log(
    `Generating meeting minutes with transcript of ${wordCount} words.`
  );

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
        __dirname,
        "..",
        "cred",
        "service_account.json"
      );

      const req = {
        contents: [{ role: "user", parts: [{ text: transcript }] }],
      };

      console.log("Sending request to Summary Model");
      // sendMessageToRoom(meetingId, "meetingMinute", `Sending request to Summary Model`, 'processing');

      const result = await summaryModel.generateContent(req);
      const output = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      const generatedText = cleanString(output)

      if (generatedText) {
        const req2 = {
          contents: [{ role: "user", parts: [{ text: generatedText }] }],
        };

        console.log("Sending request to Meeting Model");
        // sendMessageToRoom(meetingId, "meetingMinute", `Sending request to Meeting Model`, 'processing');

        const result = await meetingModel.generateContent(req2);
        const output = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        const generatedHtml = cleanString(output)

        // // API Testing
        // await MeetingModel.findByIdAndUpdate(meetingId, {
        //   transcribeData: generatedHtml
        // });

        return generatedHtml;
       
      } else {
        console.log("No content generated or structure mismatch.");
        sendMessageToRoom(meetingId, "meetingMinute", `No content generated from Model`, 'failed');
        return null;
      }
    } catch (e) {
      await MeetingModel.findByIdAndUpdate(meetingId, {
        status: "failed",
        errorMessage: 'Failed to generate meeting minutes.',
      });

      sendMessageToRoom(meetingId, "meetingMinute", `Failed to generate meeting minutes`, 'failed');

      if (e.message.includes("Quota exceeded")) {
        const delay =
          Math.min(baseDelay * 2 ** attempt, maxDelay) + Math.random() * 10000;
        console.log(
          `Quota exceeded: ${e}. Retrying in ${delay.toFixed(0)} ms.`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`Error in summarizeTranscriptWithVertex: ${e}`);
        throw e;
      }
    }
  }
  throw new Error(
    "Max retries exceeded. Please try again later or request a quota increase."
  );
}

function cleanUpFiles() {
  const rootDirectory = path.join(__dirname, "..");
  const uploadsDirectory = path.join(__dirname, "..", "uploads");

  [rootDirectory, uploadsDirectory].forEach((dir) => {
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);

      // Only delete .mp3 and .wav files from both directories
      const isAudioFile = file.endsWith(".mp3") || file.endsWith(".wav");
      const isUploadsDir = dir === uploadsDirectory;

      if (isAudioFile || isUploadsDir) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${filePath}`);
        } catch (e) {
          console.error(`Error deleting file: ${filePath} - ${e}`);
        }
      }
    });
  });
}

module.exports = {
  convertLargeVideoToMp3,
  convertAudioToMp3,
  uploadFileToGcs,
  generateSignedUrl,
  downloadFromGcs,
  transcribeAudioWithChunking,
  summarizeTranscriptWithVertex,
  getAudioDuration,
  cleanUpFiles,
};
