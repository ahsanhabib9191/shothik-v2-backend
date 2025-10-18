const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
stealthPlugin.enabledEvasions.delete("media.codecs");
puppeteer.use(stealthPlugin);
const { Queue } = require("bullmq");

const path = require("path");
const os = require("os");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
if (os.platform() === "win32") {
	const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
	ffmpeg.setFfmpegPath(ffmpegPath);
	console.log("Using ffmpeg from @ffmpeg-installer on Windows");
} else {
	ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");
	console.log("Using system-installed ffmpeg on Linux/Docker");
}

const { Storage } = require("@google-cloud/storage");
const { CLOUD_BUCKET, CHROME_PATH } = require("../config/constant");
const { removeEnclosedText } = require("../lib/trimmer");
const {
	convertVideoToMp3,
	deleteLocalFile,
} = require("./transcription.helper");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const { meetingModel } = require("../vertext/vertextmeeting");
const { MeetingModel } = require("../mongo/models/meetingMinute");
const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { default: mongoose } = require("mongoose");
const moment = require("moment");
const { RatingModel } = require("../mongo/models/MeetingRating");
const sendEmail = require("../lib/sendEmail");
const { multiModel } = require("../vertext/vertext");
const { sendMessage } = require("../lib/pusher");
const { redisConfig } = require("../lib/Redis");
const {
	summarizeTranscriptWithVertex,
	cleanUpFiles,
	convertAudioToMp3,
	convertLargeVideoToMp3,
	uploadFileToGcs,
	transcribeAudioWithChunking,
} = require("../lib/convert");
const { sendMessageToRoom } = require("../services/socketService");

const meetingMinuteQueue = new Queue("meeting-minute", {
	connection: redisConfig,
});

const storage = new Storage({
	keyFilename: path.join(__dirname, "..", "cred", "service_account.json"),
});

const bucket = storage.bucket(CLOUD_BUCKET);

const MAX_FILE_SIZE = 500 * 1024 * 1024;

// ================Create meeting minutes=================

module.exports.meetingTranscribtion = async (req, res) => {
	const { title, language, duration, participants, notes, keyNotes, type } =
		req.body;
	console.log("File transcription function started");

	if (!req.files || Object.keys(req.files).length === 0) {
		console.log("No files were uploaded");
		return res.status(400).send("No files were uploaded.");
	}

	if (!req.files.file) {
		console.log("File name not found in the request");
		return res.status(400).send("file name not found");
	}

	const originalName = req.files.file.name;
	const date = new Date();
	const timestamp = date.toISOString().replace(/[:.-]/g, "");
	var ext = String(originalName).split(".").pop().toLowerCase();
	const name = `${timestamp}.${ext}`;
	let uploadPath = path.join(__dirname, "..", "uploads", name);

	console.log(`File name: ${name}, Extension: ${ext}`);
	console.log(`Upload path: ${uploadPath}`);

	if (!isValidFileType(ext)) {
		console.log("Unsupported file type");
		return res.status(400).send({
			success: false,
			error: "UNSUPPORTED",
			message: "Unsupported file type.",
		});
	}
	const file = req.files.file;
	let originalFile = null;

	if (file.size > MAX_FILE_SIZE) {
		return res
			.status(400)
			.send(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`);
	}

	file.mv(uploadPath, async function (err) {
		if (err) {
			console.error("Error moving file:", err);
			return res.status(500).send(err);
		}

		let newName = null;
		let filename = null;
		let file = null;
		let fileBuffer = null;

		// if video then convert it to mp3
		if (
			ext === "mp4" ||
			ext === "mov" ||
			ext === "avi" ||
			ext === "mkv" ||
			ext === "flv" ||
			ext === "wmv" ||
			ext === "mpg" ||
			ext === "mpeg" ||
			ext === "3gp" ||
			ext === "webm" ||
			ext === "wav"
		) {
			sendMessage("meeting-minute", "progress", "Converting file");
			await convertVideoToMp3(uploadPath, name);
			// replace the upload path extension to mp3
			originalFile = uploadPath;
			uploadPath = uploadPath.replace("." + ext, ".mp3");
			console.log(`Upload path: ${uploadPath}`);

			// config
			newName = Date.now().toString() + ".mp3";
			filename = `kyc/${newName}`;
			file = bucket.file(filename);
			fileBuffer = fs.readFileSync(uploadPath);

			ext = "mp3";
		} else {
			newName = Date.now().toString() + "." + String(name).split(".")[1];
			filename = `kyc/${newName}`;
			file = bucket.file(filename);
			fileBuffer = fs.readFileSync(uploadPath);
		}

		try {
			console.log("Uploading file to Google Cloud Storage");
			sendMessage("meeting-minute", "progress", "Uploading");

			await file.save(fileBuffer, {
				metadata: { contentType: `image/${ext}` },
			});

			// const [metadata] = await file.getMetadata();
			const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
			console.log(`File uploaded. Public URL: ${publicUrl}`);

			// Remove file from local
			deleteLocalFile(uploadPath, originalFile);

			// Transcribe
			console.log("Generating transcription");
			sendMessage("meeting-minute", "progress", "Generating transcription");
			const data = await TranscribeFileToText(filename, ext);
			const numberRegex = /[০-৯0-9]/g;
			const symbolRegex = /[*#.\-]/g;
			const newlineAfterColonRegex = /:(\n+)/g;
			const newlineRegex = /\n+/g;
			const noiseRegex = /<noise>/g;

			const cleanString =
				data &&
				data.data
					.replace(numberRegex, "")
					.replace(symbolRegex, "")
					.replace(newlineAfterColonRegex, "")
					.replace(newlineRegex, "")
					.replace(noiseRegex, "");

			console.log("Generating meeting minutes");
			sendMessage("meeting-minute", "progress", "Generating meeting minutes");
			const finalData = await ConvertTextToMeeting(cleanString);
			const finalString =
				finalData &&
				finalData.data
					.replace(numberRegex, "")
					.replace(symbolRegex, "")
					.replace(newlineAfterColonRegex, "")
					.replace(newlineRegex, "")
					.replace(noiseRegex, "")
					.replace(/```html|```/g, "");

			console.log("Generate success, sending response");
			// save meeting data
			const meetingData = new MeetingModel({
				author: req.id,
				title,
				duration,
				type,
				participants,
				language,
				notes,
				keyNotes,
				media: publicUrl,
				transcribeData: finalString,
			});

			const result = await meetingData.save();

			return res.json({ data: finalString, meetingData: result });
		} catch (error) {
			console.error(`Error on Finished: ${error}`);
			saveErrorLog(error.message, "high", file, "meeting_minutes");
			if (error.message == "content.content.parts is not iterable") {
				return res.status(500).json({
					success: false,
					error: "SERVER_ERROR",
					message:
						"Unable to create meeting minutes! Please don't use any swear and vulgar word.",
				});
			} else {
				return res.status(500).json({
					success: false,
					error: "SERVER_ERROR",
					message: error.message,
				});
			}
		}
	});
};

// module.exports.meetingTranscribtion = async (req, res) => {
//   const { title, duration, participants, notes, keyNotes, type } = req.body;
//   console.log("File transcription function started");

//   if (!req.files || Object.keys(req.files).length === 0) {
//     return res.status(400).send("No files were uploaded.");
//   }

//   const file = req.files.file;
//   const originalName = file.name;
//   const date = new Date();
//   const timestamp = date.toISOString().replace(/[:.-]/g, "");
//   const ext = originalName.split(".").pop().toLowerCase();
//   const name = `${timestamp}.${ext}`;
//   let uploadPath = path.join(__dirname, "..", "uploads", name);

//   if (!isValidFileType(ext)) {
//     return res.status(400).send({ success: false, error: "UNSUPPORTED", message: "Unsupported file type." });
//   }

//   if (file.size > MAX_FILE_SIZE) {
//     return res.status(400).send(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`);
//   }

//   try {
//     await file.mv(uploadPath);

//     const meetingData = new MeetingModel({ author: req.id, title, duration, type, participants, notes, keyNotes, status: 'queued' });
//     const result = await meetingData.save();

//     await meetingMinuteQueue.add(`meeting-minute-${result._id}`, {
//       uploadPath,
//       ext,
//       meetingId: result._id,
//       userId: req.id,
//     }, {
//       attempts: 3,
//       backoff: { type: 'exponential', delay: 1000 },
//     });

//     res.json({ message: "File uploaded successfully. Processing queued.", meetingId: result._id });

//   } catch (error) {
//     console.error(`Error: ${error}`);
//     return res.status(500).json({ success: false, error: "SERVER_ERROR", message: error.message });
//   }
// };

module.exports.createMeetingMinute = async (req, res) => {
	const {
		userId,
		title,
		duration,
		participants,
		notes,
		keyNotes,
		type,
		publicUrl,
		transcribeData,
	} = req.body;
	try {
		const meetingData = new MeetingModel({
			author: userId,
			title,
			duration,
			type,
			participants,
			notes,
			keyNotes,
			media: publicUrl,
			transcribeData: transcribeData,
		});

		const result = await meetingData.save();
		console.log(
			"======================================> Done Meeting minutes ",
			result,
		);

		return res.json({ data: transcribeData, meetingData: result });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ success: false, message: error.message });
	}
};

module.exports.createTableMeetingMinute = async (req, res) => {
	const { title, language, participants, notes, keyNotes, type } = req.body;
	console.log("File transcription function started");

	if (!req.files || Object.keys(req.files).length === 0) {
		console.log("No files were uploaded");
		return res.status(400).send("No files were uploaded.");
	}

	if (!req.files.file) {
		console.log("File name not found in the request");
		return res.status(400).send("File name not found");
	}

	const originalName = req.files.file.name;
	const file = req.files.file;
	const timestamp = Date.now();
	const fileExt = String(originalName).split(".").pop().toLowerCase();
	const newFilename = `${timestamp}.${fileExt}`;
	const uploadDir = path.join(__dirname, "..", "uploads");
	const filePath = path.join(uploadDir, newFilename);

	if (!fs.existsSync(uploadDir)) {
		console.log(`Creating upload directory at ${uploadDir}`);
		fs.mkdirSync(uploadDir, { recursive: true });
	}

	console.log(
		`File name: ${originalName}, Extension: ${fileExt}, File path: ${filePath}`,
	);

	if (!isValidFileType(fileExt)) {
		console.log("Unsupported file type");
		return res.status(400).send({
			success: false,
			error: "UNSUPPORTED",
			message: "Unsupported file type.",
		});
	}

	if (file.size > MAX_FILE_SIZE) {
		return res
			.status(400)
			.send(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`);
	}

	try {
		file.mv(filePath, async function (err) {
			if (err) {
				console.error("Error moving file:", err);
				return res.status(500).send(err);
			}

			const meetingData = new MeetingModel({
				author: req.id,
				title,
				type,
				participants,
				language,
				notes,
				keyNotes,
				platform: 'uploaded-meeting',
				status: "processing",
			});

			const createdMeeting = await meetingData.save();

			// Immediate response to the client before background processing starts
			res
				.status(201)
				.json({
					success: true,
					message: "Meeting is being created in the background...",
					meetingId: createdMeeting._id,
				});

			// Use setImmediate to start the background processing after sending response
			setImmediate(async () => {
				try {
					await generateMeetingMinute(filePath, createdMeeting._id, language);
				} catch (error) {
					console.error(`Error during background processing: ${error}`);
				}
			});
		});
	} catch (error) {
		console.error(`Error in createTableMeetingMinute: ${error}`);
		saveErrorLog(error.message, "high", file, "meeting_minutes");

		return res.status(500).json({
			success: false,
			error: "SERVER_ERROR",
			message: error.message,
		});
	}
};

module.exports.transcribeFromFile = async (req, res) => {
	let { direction } = req.body;

	console.log("File transcription function started");

	if (!req.files || Object.keys(req.files).length === 0) {
		console.log("No files were uploaded");
		return res.status(400).send("No files were uploaded.");
	}

	if (!req.files.file) {
		console.log("File name not found in the request");
		return res.status(400).send("File name not found");
	}

	const originalName = req.files.file.name;
	const file = req.files.file;
	const timestamp = Date.now();
	const fileExt = String(originalName).split(".").pop().toLowerCase();
	const newFilename = `${timestamp}.${fileExt}`;
	const uploadDir = path.join(__dirname, "..", "uploads");
	const filePath = path.join(uploadDir, newFilename);

	if (!fs.existsSync(uploadDir)) {
		console.log(`Creating upload directory at ${uploadDir}`);
		fs.mkdirSync(uploadDir, { recursive: true });
	}

	console.log(
		`File name: ${originalName}, Extension: ${fileExt}, File path: ${filePath}`,
	);

	if (!isValidFileType(fileExt)) {
		console.log("Unsupported file type");
		return res.status(400).send({
			success: false,
			error: "UNSUPPORTED",
			message: "Unsupported file type.",
		});
	}

	if (file.size > MAX_FILE_SIZE) {
		return res
			.status(400)
			.send(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`);
	}

	try {
		file.mv(filePath, async function (err) {
			if (err) {
				console.error("Error moving file:", err);
				return res.status(500).send(err);
			}

			let mp3FilePath = filePath;

			if ([".mp4", ".avi", ".mov", ".flv", ".wmv", ".webm"].includes(fileExt)) {
				console.log(`Converting video file ${filePath} to mp3`);
				mp3FilePath = await convertLargeVideoToMp3(filePath);
			} else if ([".wav", ".m4a"].includes(fileExt)) {
				console.log(`Converting audio file ${filePath} to mp3`);
				mp3FilePath = await convertAudioToMp3(filePath);
			}

			console.log("Uploading file to Google Cloud Storage");
			const { fileUrl } = await uploadFileToGcs("uploads", mp3FilePath);

			if (!fileUrl) {
				console.log("File URL is missing after upload to GCS");
				return;
			}

			try {
				console.log(`Transcribing audio from URL: ${mp3FilePath}`);
				const data = await transcribeAudioWithChunking(mp3FilePath, direction);

				const cleanString =
					data && data.replace(/[০-৯0-9*#.\-\n:]/g, "").replace(/<noise>/g, "");

				// save UsageLogs
				// if (req.user) {
				// 	saveUsagesLogs(req.id, req.body, response, cleanString, 'translator');
				// }
				console.log("Transcription completed, sending response");
				return res.json({
					content: cleanString,
				});
			} catch (error) {
				console.error(`Error in createTableMeetingMinute: ${error}`);
			} finally {
				cleanUpFiles();
			}
		});
	} catch (error) {
		console.error(`Error in createTableMeetingMinute: ${error}`);
		saveErrorLog(error.message, "high", file, "meeting_minutes");

		return res.status(500).json({
			success: false,
			error: "SERVER_ERROR",
			message: error.message,
		});
	}
};

async function generateMeetingMinute(filePath, meetingId, language) {
	let fileExt = path.extname(filePath).toLowerCase();
	let mp3FilePath = filePath;

	if ([".mp4", ".avi", ".mov", ".flv", ".wmv", ".webm"].includes(fileExt)) {
		console.log(`Converting video file ${filePath} to mp3`);
		mp3FilePath = await convertLargeVideoToMp3(filePath);
	} else if ([".wav", ".m4a"].includes(fileExt)) {
		console.log(`Converting audio file ${filePath} to mp3`);
		mp3FilePath = await convertAudioToMp3(filePath);
	}

	try {
		console.log("Starting file upload to Google Cloud Storage");
		sendMessageToRoom(meetingId, "meetingMinute", `Starting file upload`, 'processing');

		const { fileUrl, publicUrl, duration } = await uploadFileToGcs(
			"uploads",
			mp3FilePath,
		);

		if (!fileUrl) {
			console.log("File URL is missing after upload to GCS");
			return;
		}

		console.log(`Starting to Process the File: ${mp3FilePath}`);
		sendMessageToRoom(meetingId, "meetingMinute", `Starting to Process the File`, 'processing');

		const data = await transcribeAudioWithChunking(mp3FilePath, language, meetingId);

		const cleanString =
			data && data.replace(/[০-৯0-9*#.\-\n:]/g, "").replace(/<noise>/g, "");

		console.log("Generating meeting minutes");
		sendMessageToRoom(meetingId, "meetingMinute", `Generating meeting minutes`, 'processing');

		const finalData = await summarizeTranscriptWithVertex(cleanString, meetingId);

		await MeetingModel.findByIdAndUpdate(meetingId, {
			status: "completed",
			transcribeData: finalData
				.replace(/[০-৯0-9*#.\-\n:]/g, "")
				.replace(/<noise>/g, "")
				.replace(/```html|```/g, ""),
			media: publicUrl,
			duration,
		});

		console.log("Meeting generated successfully");
		sendMessageToRoom(meetingId, "meetingMinute", `Meeting generated successfully`, 'completed');
	} catch (error) {
		console.error(`Error in generateMeetingMinute: ${error}`);
		saveErrorLog(error.message, "high", null, "meeting_minutes");
	} finally {
		cleanUpFiles();
	}
}

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

async function TranscribeFileToText(filename, ext) {
	console.log("TranscribeFileToText function started");

	process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
		__dirname,
		"..",
		"cred",
		"service_account.json",
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
		"service_account.json",
	);

	const req = {
		contents: [{ role: "user", parts: [{ text: `${cleanedTranscribeData}` }] }],
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


// =======================================End meeting minutes=============================================

module.exports.testMeetingMinute = async (req, res) => {
	const {text, meetingId } = req.body;
	try {
		const data = await summarizeTranscriptWithVertex(text, meetingId);

		res.status(200).json({success: true, data})
	} catch (error) {
		console.log(error);
		return res.status(500).json({success: false, message: error.message})
	}
}

// ================Get all meeting minutes=================
module.exports.getAllMeeting = async (req, res) => {
	try {
		const { keyword, month, limit, page } = req.query;

		// Default values for pagination
		const perPage = limit ? parseInt(limit, 10) : 10;
		const currentPage = page ? parseInt(page, 10) : 1;

		const matchStage = {};

		if (keyword) {
			matchStage.title = new RegExp(keyword, "i");
		}

		if (month) {
			const monthNumber = moment().month(month).month() + 1;
			matchStage.$expr = { $eq: [{ $month: "$createdAt" }, monthNumber] };
		}

		const aggregationPipeline = [
			{ $match: matchStage },
			{
				$lookup: {
					from: "users",
					localField: "author",
					foreignField: "_id",
					as: "author",
				},
			},
			{ $unwind: "$author" },
			{
				$facet: {
					data: [
						{ $sort: { createdAt: -1 } },
						{ $skip: (currentPage - 1) * perPage },
						{ $limit: perPage },
					],
					totalCount: [{ $count: "count" }],
				},
			},
			{
				$project: {
					"data.__v": 0,
					"data.author.__v": 0,
					"data.author.password": 0,
					"data.author.googleAccessToken": 0,
					"data.author.googleRefreshToken": 0,
					"data.author.googleTokenExpiryDate": 0,
					"data.author.updatedAt": 0,
					"data.author.address": 0,
					"data.author.city": 0,
					"data.transcribeData": 0,
				},
			},
		];

		const result = await MeetingModel.aggregate(aggregationPipeline);
		const meetings = result[0].data;
		const count = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

		const totalPages = Math.ceil(count / perPage);
		const nextPage = currentPage < totalPages ? currentPage + 1 : null;
		let nextUrl = null;

		if (nextPage) {
			nextUrl = `${
				req.originalUrl.split("?")[0]
			}?limit=${perPage}&page=${nextPage}`;
			if (keyword) {
				nextUrl += `&keyword=${keyword}`;
			}
			if (month) {
				nextUrl += `&month=${month}`;
			}
		}

		res.status(200).json({
			success: true,
			data: meetings || [],
			total: count,
			perPage,
			currentPage,
			totalPages,
			nextPage,
			nextUrl,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Get meeting minutes by user=================
module.exports.getMyMeeting = async (req, res) => {
	const userId = new mongoose.Types.ObjectId(req.id);
	try {
		const user = await User.findOne({ _id: userId });
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found" });
		}

		const { keyword, month, year } = req.query;
		let perPage;

		if (req.query && typeof req.query.limit === "string") {
			perPage = parseInt(req.query.limit, 10);
		}

		const matchStage = { author: userId };

		if (keyword) {
			matchStage.title = new RegExp(keyword, "i");
		}

		if (month) {
			const monthNumber = moment().month(month).month() + 1; // Adjusted to use correct month number
			if (!matchStage.$expr) {
				matchStage.$expr = {};
			}
			matchStage.$expr.$eq = [{ $month: "$createdAt" }, monthNumber];
		}

		if (year) {
			const yearNumber = parseInt(year, 10);
			if (!matchStage.$expr) {
				matchStage.$expr = {};
			}
			matchStage.$expr.$eq = [{ $year: "$createdAt" }, yearNumber];
		}

		const aggregationPipeline = [
			{ $match: matchStage },
			{
				$lookup: {
					from: "users",
					localField: "author",
					foreignField: "_id",
					as: "author",
				},
			},
			{ $unwind: "$author" },
			{
				$facet: {
					data: [
						{ $sort: { createdAt: -1 } },
						...(perPage !== undefined
							? [{ $skip: (req.query.page - 1) * perPage }, { $limit: perPage }]
							: []),
					],
					totalCount: [{ $count: "count" }],
					months: [
						{
							$group: {
								_id: {
									month: { $month: "$createdAt" },
									year: { $year: "$createdAt" },
								},
								count: { $sum: 1 },
							},
						},
						{ $sort: { "_id.year": 1, "_id.month": 1 } },
						{
							$project: {
								_id: 0,
								month: "$_id.month",
								year: "$_id.year",
							},
						},
					],
				},
			},
			{
				$project: {
					"data.__v": 0,
					"data.author.__v": 0,
					"data.author.password": 0,
					"data.author.googleAccessToken": 0,
					"data.author.googleRefreshToken": 0,
					"data.author.googleTokenExpiryDate": 0,
					"data.author.updatedAt": 0,
					"data.author.address": 0,
					"data.author.city": 0,
					"data.transcribeData": 0,
				},
			},
		];

		console.log(
			"aggregationPipeline:",
			JSON.stringify(aggregationPipeline, null, 2),
		); // Debugging statement

		const result = await MeetingModel.aggregate(aggregationPipeline);
		const meetings = result[0].data;
		const count = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

		console.log("meetings:", meetings); // Debugging statement
		console.log("count:", count); // Debugging statement

		const currentPage = req.query.page ? parseInt(req.query.page, 10) : 1;
		let totalPages;

		if (perPage !== undefined) {
			totalPages = Math.ceil(count / perPage);
		}

		let nextPage;
		let nextUrl;

		if (perPage !== undefined && currentPage < totalPages) {
			nextPage = currentPage + 1;
			nextUrl = `${
				req.originalUrl.split("?")[0]
			}?limit=${perPage}&page=${nextPage}`;
			if (keyword) {
				nextUrl += `&keyword=${keyword}`;
			}
			if (month) {
				nextUrl += `&month=${month}`;
			}
			if (year) {
				nextUrl += `&year=${year}`;
			}
		}

		const months = result[0].months.map((m) => ({
			month: moment()
				.month(m.month - 1)
				.format("MMMM"),
			year: m.year,
		}));

		res.status(200).json({
			success: true,
			data: meetings || [],
			total: count,
			perPage,
			currentPage,
			totalPages,
			nextPage,
			nextUrl,
			months,
		});
	} catch (error) {
		console.error("Error:", error); // Debugging statement
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Update meeting minute=================
module.exports.updateMeeting = async (req, res) => {
	const newData = req.body;
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	try {
		const meeting = await MeetingModel.findById(meetingId);
		if (!meeting) {
			throw Error("Meeting not found");
		}

		const updatedData = { ...meeting.toObject(), ...newData };

		await MeetingModel.findByIdAndUpdate(meetingId, updatedData);

		res.status(200).json({
			success: true,
			message: "Meeting Updated",
			data: updatedData,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Update meeting minute visibility=================
module.exports.updateMeetingVisibility = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	const userId = req.id;
	const { visibility } = req.body;
	try {
		const meeting = await MeetingModel.findById(meetingId);
		if (!meeting) {
			throw Error("Meeting not found");
		}

		if (meeting.author.toString() !== userId) {
			throw Error("Only author can update");
		}

		meeting.visibility = visibility;

		const updatedData = await meeting.save();

		res.status(200).json({
			success: true,
			message: "Meeting Updated",
			data: updatedData,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Delete meeting minute=================
module.exports.deleteMeeting = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	const userId = req.id;
	try {
		const meeting = await MeetingModel.findById(meetingId);
		if (!meeting) {
			throw Error("Meeting not found");
		}
		if (meeting.author.toString() !== userId) {
			throw Error("Only author can delete");
		}

		await MeetingModel.findOneAndDelete(meetingId);

		res.status(200).json({
			success: true,
			message: "Meeting deleted",
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Delete multiple meeting minute=================
module.exports.deleteMultipleMeetings = async (req, res) => {
	const IDS = req.body.ids;
	const meetingIds = IDS.map((id) => new mongoose.Types.ObjectId(id));

	try {
		const meetings = await MeetingModel.deleteMany({
			_id: { $in: meetingIds },
		});
		if (meetings.deletedCount < 1) {
			throw Error("Meeting not found");
		}

		res.status(200).json({
			success: true,
			message: "Meetings deleted",
			count: meetings.deletedCount,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Single meeting minute=================
module.exports.singleMeeting = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	const userId = new mongoose.Types.ObjectId(req.id);

	try {
		const exist = await MeetingModel.findOne({ _id: meetingId })
			.populate({
				path: "author",
				select: "-__v -password",
			})
			.populate({
				path: "transcription",
				select: "-__v",
			});

		if (!exist) {
			return res
				.status(404)
				.json({ success: false, message: "Meeting not found" });
		}

		if (exist.author && exist.author._id.equals(userId)) {
			return res.status(200).json({
				success: true,
				message: "Meeting found",
				data: exist,
			});
		} else {
			const meeting = await MeetingModel.findOne({
				_id: meetingId,
				visibility: true,
			})
				.populate({
					path: "author",
					select: "-__v -password",
				})
				.populate({
					path: "transcription",
					select: "-__v",
				});

			if (!meeting) {
				return res
					.status(404)
					.json({ success: false, message: "Meeting minute is private" });
			}

			if (!req.id && !meeting.visibility) {
				return res.status(401).json({
					success: false,
					message: "You need to login first",
				});
			} else if (req.id && !meeting.visibility) {
				return res.status(403).json({
					success: false,
					message: "Meeting minute is private",
				});
			} else {
				return res.status(200).json({
					success: true,
					message: "Meeting found",
					data: meeting,
				});
			}
		}
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Create Meeting Rating=================
module.exports.ratingMeeting = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	const userId = new mongoose.Types.ObjectId(req.id);
	const { rating, message } = req.body;

	try {
		const meeting = await MeetingModel.findById(meetingId);
		if (!meeting) {
			return res
				.status(404)
				.json({ success: false, message: "Meeting not found" });
		}

		// Check if the user has already rated this meeting
		let existRating = await RatingModel.findOne({
			meeting: meetingId,
			user: userId,
		});

		if (existRating) {
			// Update existing rating
			existRating.rating = rating;
			await existRating.save();
			return res.status(200).json({
				success: true,
				message: "Rating updated successfully",
				data: existRating,
			});
		} else {
			// Create new rating
			existRating = new RatingModel({
				meeting: meetingId,
				user: userId,
				rating,
				message,
			});
			await existRating.save();
			return res.status(201).json({
				success: true,
				message: "Rating created successfully",
				data: existRating,
			});
		}
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Get Meeting Rating=================
module.exports.averageRating = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);

	try {
		const meeting = await MeetingModel.findById(meetingId);
		if (!meeting) {
			return res
				.status(404)
				.json({ success: false, message: "Meeting not found" });
		}

		// Retrieve all ratings for the meeting
		const ratings = await RatingModel.find({ meeting: meetingId }).populate({
			path: "user",
			select: "name email",
		});

		// If no ratings found
		if (ratings.length === 0) {
			return res.status(200).json({
				success: true,
				message: "No ratings found for this meeting",
				data: {
					averageRating: null,
					ratings: [],
				},
			});
		}

		// Calculate the average rating
		const totalRatings = ratings.reduce(
			(sum, rating) => sum + rating.rating,
			0,
		);
		const averageRating = totalRatings / ratings.length;

		// Respond with the average rating and all individual ratings
		return res.status(200).json({
			success: true,
			message: "Ratings retrieved successfully",
			data: {
				averageRating: averageRating,
				ratings: ratings,
			},
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Meeting Email=================
module.exports.sendMeetingEmail = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	const userId = new mongoose.Types.ObjectId(req.id);
	try {
		const meeting = await MeetingModel.findById(meetingId);
		if (!meeting) {
			return res
				.status(404)
				.json({ success: false, message: "Meeting not found" });
		}

		const user = await User.findById(userId);
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found" });
		}

		await sendEmail({
			name: user.name,
			email: user.email,
			subject: `${meeting.title} by Shothik AI`,
			message: `${meeting.transcribeData}`,
		});

		res.status(200).json({
			success: true,
			message: "Send email successfully",
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

// ================Meeting PDF=================
module.exports.convertMeetingPDF = async (req, res) => {
	const meetingId = new mongoose.Types.ObjectId(req.params.id);
	try {
		const meeting = await MeetingModel.findById(meetingId).populate({
			path: "author",
			select: "-__v -password",
		});
		if (!meeting) {
			throw new Error("Meeting not found");
		}

		const dynamicContent = meeting.transcribeData;

		const htmlContent = `
      <html>
          <head>
              <style>
                  @import url('https://fonts.maateen.me/kalpurush/font.css');

                  body {
                      font-family: 'Kalpurush', sans-serif;
                  }
                  
                  table, th, td {
                      border: 1px solid black;
                      border-collapse: collapse;
                  }
                  
                  th, td {
                      padding: 8px;
                      text-align: left;
                  }
              </style>
          </head>
          <body>
              ${dynamicContent}
          </body>
      </html>
  `;

		const pdfPath = path.join(__dirname, "..", "pdf", "meeting_minutes.pdf");

		// Ensure the directory exists
		if (!fs.existsSync(path.dirname(pdfPath))) {
			fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
		}

		// Convert HTML to PDF
		await convertHtmlToPdf(htmlContent, pdfPath);

		// Download the PDF file
		res.download(pdfPath, "meeting_minutes.pdf", (err) => {
			if (err) {
				console.error("Error downloading PDF:", err);
				res.status(500).send("Error downloading PDF");
			} else {
				fs.unlinkSync(pdfPath);
			}
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message });
	}
};

async function convertHtmlToPdf(htmlContent, pdfPath) {
	let browser;
	const isLinux = os.platform() === "linux";

	try {
		browser = await puppeteer.launch({
			headless: true,
			executablePath: isLinux
				? CHROME_PATH
				: "C:/Program Files/Google/Chrome/Application/chrome.exe",
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		// Create a new page
		const page = await browser.newPage();

		// Set the page content to the provided HTML
		await page.setContent(htmlContent, { waitUntil: "networkidle0" });

		// Inject the Bangla font into the page
		await injectBanglaFont(page);

		// Generate the PDF with the specified path and format
		await page.pdf({ path: pdfPath, format: "A4" });

		console.log(`PDF created successfully at ${pdfPath}`);
	} catch (error) {
		console.error("Error generating PDF:", error);
		throw error;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

async function injectBanglaFont(page) {
	await page.evaluate(() => {
		const style = document.createElement("style");
		style.textContent = `
      @import url('https://fonts.maateen.me/kalpurush/font.css');
      
      body, .bangla-text {
        font-family: 'Kalpurush', Arial, sans-serif !important;
      }
    `;
		document.head.appendChild(style);

		console.log("Bangla font (Kalpurush) injected successfully.");
	});
}
