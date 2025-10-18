const path = require('path');
const fs = require('fs');
const {
	Storage
} = require("@google-cloud/storage");
const {
	CLOUD_BUCKET
} = require("../config/constant");
const {
	multiModel,
	generativeModel
} = require("../vertext/vertext");
const {
	removeEnclosedText
} = require("../lib/trimmer");
const {
	convertVideoToMp3,
	deleteLocalFile,
	convertDocToText
} = require('./transcription.helper');
const {
	saveErrorLog
} = require('../mongo/models/ErrorLogs');
const {
	saveUsagesLogs
} = require('../mongo/models/UsageLogs');
// const { TrackUsage } = require('../lib/TrackUsage');
const {
	sendMessage
} = require('../lib/pusher');
const {
	meetingModel
} = require('../vertext/vertextmeeting');
const {
	MeetingModel
} = require('../mongo/models/meetingMinute');

const storage = new Storage({
	keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json'),
});

const bucket = storage.bucket(CLOUD_BUCKET);

const MAX_FILE_SIZE = 500 * 1024 * 1024;

// =========================Transcribe from file============================

module.exports.Filetranscribtion = async (req, res) => {
	console.log("Filetranscription function started");

	if (!req.files || Object.keys(req.files).length === 0) {
		console.log("No files were uploaded");
		return res.status(400).send('No files were uploaded.');
	}

	if (!req.files.image) {
		console.log("File name not found in the request");
		return res.status(400).send('file name not found');
	}

	const originalName = req.files.image.name;
	const date = new Date();
	const timestamp = date.toISOString().replace(/[:.-]/g, '');
	// const language = req.body.language;
	const direction = req.body.direction;
	const file = req.files.image;
	let originalFile = null;
	var ext = String(originalName).split('.').pop().toLowerCase();
	const name = `${timestamp}.${ext}`;
	let uploadPath = path.join(__dirname, '..', 'uploads', name);

	console.log(`File name: ${name}, Extension: ${ext}`);
	console.log(`Upload path: ${uploadPath}`);

	if (!isValidFileType(ext)) {
		console.log("Unsupported file type");
		return res.status(400).send({
			success: false,
			error: "UNSUPPORTED",
			message: 'Unsupported file type.'
		});
	}

	if (file.size > MAX_FILE_SIZE) {
		return res.status(400).send(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`);
	}

	const FromLang = String(direction).toLowerCase().split('to')[0];
	const ToLang = String(direction).toLowerCase().split('to')[1];


	file.mv(uploadPath, async function(err) {
		if (err) {
			console.error("Error moving file:", err);
			return res.status(500).send(err);
		}

		let newName = null;
		let filename = null;
		let file = null;
		let fileBuffer = null;

		// remove extra tag
		const numberRegex = /[০-৯0-9]/g;
		const symbolRegex = /[*#\-]/g;
		const newlineRegex = /\n/g;
		const colonRegex = /:/g;
		const noiseRegex = /<noise>/g;

		// if video then convert it to mp3
		if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv" || ext === "flv" || ext === "wmv" || ext === "mpg" || ext === "mpeg" || ext === "3gp" || ext === "webm" || ext === "wav") {
			await convertVideoToMp3(uploadPath, name);
			// replace the upload path extension to mp3
			originalFile = uploadPath
			uploadPath = uploadPath.replace('.' + ext, '.mp3');
			console.log(`Upload path: ${uploadPath}`);

			// config
			newName = Date.now().toString() + ".mp3";
			filename = `kyc/${newName}`;
			file = bucket.file(filename);
			fileBuffer = fs.readFileSync(uploadPath);

			ext = 'mp3'

		} else {

			newName = Date.now().toString() + "." + String(name).split('.')[1];
			filename = `kyc/${newName}`;
			file = bucket.file(filename);
			fileBuffer = fs.readFileSync(uploadPath);
		}

		if (ext === "docx") {
			const data = await convertDocToText(uploadPath, name);

			console.log("Translating from text");
			const promt = {
				text: `translate from ${FromLang} to ${ToLang}: ${data}. do not give any extra word.`
			};

			try {
				// authenticate to google cloud
				process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "cred", 'service_account.json');


				const req = {
					contents: [{
						role: 'user',
						parts: [promt]
					}],
				};

				const streamingResp = await generativeModel.generateContentStream(req);

				var output = "";
				for await (const item of streamingResp?.stream) {
					var parsedResponse = JSON.parse(JSON.stringify(item));
					for (let content of parsedResponse?.candidates) {
						for (let parts of content.content.parts) {
							var text = removeEnclosedText(parts?.text);
							output += text;
						}
					}
				}

				const cleanString = output && output.replace(numberRegex, '')
					.replace(symbolRegex, '')
					.replace(newlineRegex, '')
					.replace(colonRegex, '')
					.replace(noiseRegex, '');


				// save UsageLogs
				if (req.user) {
					saveUsagesLogs(req.id, req.body, response, cleanString, 'translator');
				}
				console.log("Transcription completed, sending response");
				return res.json({
					data: cleanString
				});

			} catch (error) {
				saveErrorLog(error.message, 'high', req.body, 'translator');
				console.log(error.message);
				return res.status(500).send('Unable to extract for translation, please try again.');
			}

		} else {
			try {
				console.log("Uploading file to Google Cloud Storage");
				await file.save(fileBuffer, {
					metadata: {
						contentType: `image/${ext}`
					},
				});

				const [metadata] = await file.getMetadata();
				const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
				console.log(`File uploaded. Public URL: ${publicUrl}`);

				// Remove file from local
				deleteLocalFile(uploadPath, originalFile);

				// Transcribe 
				console.log("Starting transcription process");
				const data = await TranscribeFileToText(filename, ext, ToLang);

				const cleanString = data && data.data.replace(numberRegex, '')
					.replace(symbolRegex, '')
					.replace(newlineRegex, '')
					.replace(colonRegex, '')
					.replace(noiseRegex, '');

				console.log("Transcription completed, sending response");
				return res.json({
					data: cleanString
				});

			} catch (error) {
				console.error(`Error on Finished: ${error}`);
				saveErrorLog(error.message, 'high', {
					ToLang,
					file
				}, 'translator');
				if (error.message == 'content.content.parts is not iterable') {
					return res.status(500).json({
						success: false,
						error: 'SERVER_ERROR',
						message: "Unable to extract for translation! Please don't use any swear and vulgar word."
					})
				} else {
					return res.status(500).json({
						success: false,
						error: "SERVER_ERROR",
						message: error.message
					})
				}
			}
		}
	});
}

function isValidFileType(ext) {
	const supportedTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'ogg', 'ogv', '3gp', '3g2', 'mpeg', 'mpg', 'm4v', 'mov', 'wmv', 'pdf', 'txt', 'docx'];
	return supportedTypes.includes(ext.toLowerCase());
}

async function TranscribeFileToText(filename, ext, ToLang) {
	console.log("TranscribeFileToText function started");

	process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "cred", 'service_account.json');

	let mimeType = null;
	switch (ext) {
		case "mp3":
			mimeType = 'audio/mpeg';
			break;
		case "wav":
			mimeType = 'audio/wav';
			break;
		case "ogg":
			mimeType = 'audio/ogg';
			break;
		case "flac":
			mimeType = 'audio/flac';
			break;
		case "aac":
			mimeType = 'audio/aac';
			break;
		case "m4a":
			mimeType = 'audio/mp4';
			break;
		case "opus":
			mimeType = 'audio/opus';
			break;
		case "webm":
			mimeType = 'audio/webm';
			break;
		case "mp4":
			mimeType = 'video/mp4';
			break;
		case "avi":
			mimeType = 'video/x-msvideo';
			break;
		case "mkv":
			mimeType = 'video/x-matroska';
			break;
		case "mov":
			mimeType = 'video/quicktime';
			break;
		case "wmv":
			mimeType = 'video/x-ms-wmv';
			break;
		case "flv":
			mimeType = 'video/x-flv';
			break;
		case "webm":
			mimeType = 'video/webm';
			break;
		case "ogg":
			mimeType = 'video/ogg';
			break;
		case "ogv":
			mimeType = 'video/ogg';
			break;
		case "3gp":
			mimeType = 'video/3gpp';
			break;
		case "3g2":
			mimeType = 'video/3gpp2';
			break;
		case "mpeg":
			mimeType = 'video/mpeg';
			break;
		case "mpg":
			mimeType = 'video/mpeg';
			break;
		case "m4v":
			mimeType = 'video/x-m4v';
			break;
		case "mov":
			mimeType = 'video/quicktime';
			break;
		case "wmv":
			mimeType = 'video/x-ms-wmv';
			break;
		case "pdf":
			mimeType = 'application/pdf';
			break;
		case "txt":
			mimeType = 'text/plain';
			break;
		default:
			mimeType = 'application/octet-stream';
	}

	console.log(`MimeType for extension ${ext}: ${mimeType}`);

	const file = {
		fileData: {
			mimeType: mimeType,
			fileUri: `gs://shothik/${filename}`
		}
	};

	const req = {
		contents: [{
			role: 'user',
			parts: [file, {
				text: `Translate the file's text into ${ToLang}. Please translate directly without adding any extra words or suggestions; keep it straightforward and precise.`
			}]
		}],
	};

	console.log("Sending request to multiModel.generateContentStream");
	const streamingResp = await multiModel.generateContentStream(req);

	let data = '';

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
		data
	}
}

// =========================Generate meeting minutes============================

module.exports.meetingTranscribtion = async (req, res) => {
	const {
		title,
		duration,
		participants,
		notes,
		keyNotes,
		type,
		file_url: publicUrl
	} = req.body;
	console.log("File transcription function started");


	try {
		console.log("Uploading file to Google Cloud Storage");
		sendMessage("meeting-minute", "progress", "Uploading");

		console.log(`File uploaded. Public URL: ${publicUrl}`);
		const pathArray = publicUrl.split('?')[0].split('/');
		const filenameWithExt = pathArray[pathArray.length - 1];
		const [filename, ext] = filenameWithExt.split('.');

		const gsUrl = `gs://shothik/${filename}.${ext}`

		// const ext = filePath.split('.').pop();
		// console.log(ext);  // Output: mp3

		// Transcribe
		console.log("Generating transcription");
		sendMessage("meeting-minute", "progress", "Generating transcription");
		const data = await TranscribeUrlToText(gsUrl, ext);
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
			notes,
			keyNotes,
			media: publicUrl,
			transcribeData: finalString,
		});

		//   const result = await meetingData.save();

		return res.json({
			data: meetingData
		});
	} catch (error) {
		console.error(`Error on Finished: ${error}`);
		saveErrorLog(error.message, "high", '', "meeting_minutes");
		if (error.message == "content.content.parts is not iterable") {
			return res.status(500).json({
				success: false,
				error: "SERVER_ERROR",
				message: "Unable to create meeting minutes! Please don't use any swear and vulgar word.",
			});
		} else {
			return res.status(500).json({
				success: false,
				error: "SERVER_ERROR",
				message: error.message,
			});
		}
	}

};

async function TranscribeUrlToText(gsUrl, ext) {
	console.log("TranscribeFileToText function started");

	process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "cred", 'service_account.json');

	let mimeType = null;
	switch (ext) {
		case "mp3":
			mimeType = 'audio/mpeg';
			break;
		case "wav":
			mimeType = 'audio/wav';
			break;
		case "ogg":
			mimeType = 'audio/ogg';
			break;
		case "flac":
			mimeType = 'audio/flac';
			break;
		case "aac":
			mimeType = 'audio/aac';
			break;
		case "m4a":
			mimeType = 'audio/mp4';
			break;
		case "opus":
			mimeType = 'audio/opus';
			break;
		case "webm":
			mimeType = 'audio/webm';
			break;
		case "mp4":
			mimeType = 'video/mp4';
			break;
		case "avi":
			mimeType = 'video/x-msvideo';
			break;
		case "mkv":
			mimeType = 'video/x-matroska';
			break;
		case "mov":
			mimeType = 'video/quicktime';
			break;
		case "wmv":
			mimeType = 'video/x-ms-wmv';
			break;
		case "flv":
			mimeType = 'video/x-flv';
			break;
		case "webm":
			mimeType = 'video/webm';
			break;
		case "ogg":
			mimeType = 'video/ogg';
			break;
		case "ogv":
			mimeType = 'video/ogg';
			break;
		case "3gp":
			mimeType = 'video/3gpp';
			break;
		case "3g2":
			mimeType = 'video/3gpp2';
			break;
		case "mpeg":
			mimeType = 'video/mpeg';
			break;
		case "mpg":
			mimeType = 'video/mpeg';
			break;
		case "m4v":
			mimeType = 'video/x-m4v';
			break;
		case "mov":
			mimeType = 'video/quicktime';
			break;
		case "wmv":
			mimeType = 'video/x-ms-wmv';
			break;
		case "pdf":
			mimeType = 'application/pdf';
			break;
		case "txt":
			mimeType = 'text/plain';
			break;
		default:
			mimeType = 'application/octet-stream';
	}

	console.log(`MimeType for extension ${ext}: ${mimeType}, and gsUlr: ${gsUrl}`);

	const file = {
		fileData: {
			mimeType: mimeType,
			fileUri: `${gsUrl}`
		}
	};

	const req = {
		contents: [{
			role: "user",
			parts: [
				file,
				{
					text: `Transcribe the file's text. Please transcribe directly without adding any extra words or suggestions; keep it straightforward and precise.`,
				},
			],
		}, ],
	};

	console.log("Sending request to multiModel for converting text");
	const streamingResp = await multiModel.generateContentStream(req);

	let data = '';

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
		data
	}
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
		contents: [{
			role: "user",
			parts: [{
				text: `${cleanedTranscribeData}`
			}]
		}],
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

// =========================Transcribtion for translate ============================
module.exports.transcribtionFroTranslate = async (req, res) => {
	const {
		direction,
		file_url: publicUrl
	} = req.body;
	console.log("File transcription function started");
	const FromLang = String(direction).toLowerCase().split('to')[0];
	const ToLang = String(direction).toLowerCase().split('to')[1];

	try {
		console.log("Uploading file to Google Cloud Storage");
		const pathArray = publicUrl.split('?')[0].split('/');
		const filenameWithExt = pathArray[pathArray.length - 1];
		const [filename, ext] = filenameWithExt.split('.');

		const gsUrl = `gs://shothik/${filename}.${ext}`

		// const ext = filePath.split('.').pop();
		// console.log(ext);  // Output: mp3
		// sendMessage("meeting-minute", "progress", "Uploading");
		// Transcribe
		console.log("Generating transcription");
		sendMessage("meeting-minute", "progress", "Generating transcription");
		const data = await TranscribeUrlToText(gsUrl, ext);
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

		console.log("Transcribe success");
		const translatedData = await changeLanguage({
			FromLang,
			ToLang,
			data: cleanString
		})
		const finaldata =
			translatedData &&
			translatedData.data
			.replace(numberRegex, "")
			.replace(symbolRegex, "")
			.replace(newlineAfterColonRegex, "")
			.replace(newlineRegex, "")
			.replace(noiseRegex, "");

		console.log("Translated success");

		return res.json({
			success: true,
			data: finaldata
		});
	} catch (error) {
		console.error(`Error on Finished: ${error}`);
		saveErrorLog(error.message, "high", '', "translator");
		if (error.message == "content.content.parts is not iterable") {
			return res.status(500).json({
				success: false,
				error: "SERVER_ERROR",
				message: "Unable to create meeting minutes! Please don't use any swear and vulgar word.",
			});
		} else {
			return res.status(500).json({
				success: false,
				error: "SERVER_ERROR",
				message: error.message,
			});
		}
	}

};

const changeLanguage = async ({
	FromLang,
	ToLang,
	data
}) => {
	console.log("Translating from text");
	const promt = {
		text: `translate from ${FromLang} to ${ToLang}: ${data}. do not give any extra word.`
	};

	try {
		// authenticate to google cloud
		process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "cred", 'service_account.json');


		const req = {
			contents: [{
				role: 'user',
				parts: [promt]
			}],
		};

		const streamingResp = await generativeModel.generateContentStream(req);

		var output = "";
		for await (const item of streamingResp?.stream) {
			var parsedResponse = JSON.parse(JSON.stringify(item));
			for (let content of parsedResponse?.candidates) {
				for (let parts of content.content.parts) {
					var text = removeEnclosedText(parts?.text);
					output += text;
				}
			}
		}

		console.log("Translate completed");
		return {
			data: output
		};
	} catch (error) {
		console.log(error.message);
	}
}