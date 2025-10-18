const path = require('path');
const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { GOOGLE_CLOUD_PROJECT_ID, CLOUD_BUCKET } = require("../config/constant");
const { multiModel } = require("../vertext/vertext");
const { removeEnclosedText } = require("../lib/trimmer");
const { convertVideoToMp3, deleteLocalFile, cleanStringToJson } = require('./transcription.helper');
require('colors');


let projectId = GOOGLE_CLOUD_PROJECT_ID; // Get this from Google Cloud
const storage = new Storage({
    keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json'),
});

const bucket = storage.bucket(CLOUD_BUCKET);

module.exports.FiletranscribtionInJSONFOrmat = async (req, res) => {
    console.log("Filetranscription function started");

    if (!req.files || Object.keys(req.files).length === 0) {
        console.log("No files were uploaded");
        return res.status(400).send('No files were uploaded.');
    }

    if (!req.files.image) {
        console.log("File name not found in the request");
        return res.status(400).send('file name not found');
    }

    const name = req.files.image.name;
    var ext = String(name).split('.').pop().toLowerCase();
    let uploadPath = path.join(__dirname, '..', 'uploads', name);

    console.log(`File name: ${name}, Extension: ${ext}`);
    console.log(`Upload path: ${uploadPath}`);

    if (!isValidFileType(ext)) {
        console.log("Unsupported file type");
        return res.status(400).send({success: false, error: "UNSUPPORTED", message: 'Unsupported file type.'});
    }

    const file = req.files.image;
    let originalFile = null;

    file.mv(uploadPath, async function(err) {
        if (err) {
            console.error("Error moving file:", err);
            return res.status(500).send(err);
        }

        let newName = null;
        let filename = null;
        let file = null;
        let fileBuffer = null;

        // if video then convert it to mp3
        if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv" || ext === "flv" || ext === "wmv" || ext === "mpg" || ext === "mpeg" || ext === "3gp" || ext === "webm" || ext === "wav") {
            await convertVideoToMp3(uploadPath , name);
            // replace the upload path extension to mp3
            originalFile = uploadPath
            uploadPath = uploadPath.replace('.' + ext, '.mp3');
            console.log(`Upload path: ${uploadPath}`);

            /// config
            newName = Date.now().toString() + ".mp3";
            filename = `kyc/${newName}`;
            file = bucket.file(filename);
            fileBuffer = fs.readFileSync(uploadPath);

            ext = 'mp3'

        }else{

            newName = Date.now().toString() + "." + String(name).split('.')[1];
            filename = `kyc/${newName}`;
            file = bucket.file(filename);
            fileBuffer = fs.readFileSync(uploadPath);
        }



        try {
            console.log("Uploading file to Google Cloud Storage");
            await file.save(fileBuffer, {
                metadata: { contentType: `image/${ext}` },
            });

            const [metadata] = await file.getMetadata();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            console.log(`File uploaded. Public URL: ${publicUrl}`);

            // Remove file from local
            console.log('Deleting local file');
            deleteLocalFile(uploadPath, originalFile);

            // Transcribe 
            console.log("Starting transcription process");
            const data = await TranscribeFileToText(filename, ext);
            return res.json(data);

        } catch (error) {
            console.error(`Error on Finished: ${error}`);
            return res.status(500).send('Unable to extract transcription, please try again.');
        }
    });
}

function isValidFileType(ext) {
    const supportedTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'ogg', 'ogv', '3gp', '3g2', 'mpeg', 'mpg', 'm4v', 'mov', 'wmv'];
    return supportedTypes.includes(ext.toLowerCase());
}
async function TranscribeFileToText(filename, ext) {
    console.log("TranscribeFileToText function started");

    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..", "cred", 'service_account.json');

    let mimeType = null;
    switch (ext) {
        case "mp3": mimeType = 'audio/mpeg'; break;
        case "wav": mimeType = 'audio/wav'; break;
        case "ogg": mimeType = 'audio/ogg'; break;
        case "flac": mimeType = 'audio/flac'; break;
        case "aac": mimeType = 'audio/aac'; break;
        case "m4a": mimeType = 'audio/mp4'; break;
        case "opus": mimeType = 'audio/opus'; break;
        case "webm": mimeType = 'audio/webm'; break;
        case "mp4": mimeType = 'video/mp4'; break;
        case "avi": mimeType = 'video/x-msvideo'; break;
        case "mkv": mimeType = 'video/x-matroska'; break;
        case "mov": mimeType = 'video/quicktime'; break;
        case "wmv": mimeType = 'video/x-ms-wmv'; break;
        case "flv": mimeType = 'video/x-flv'; break;
        case "webm": mimeType = 'video/webm'; break;
        case "ogg": mimeType = 'video/ogg'; break;
        case "ogv": mimeType = 'video/ogg'; break;
        case "3gp": mimeType = 'video/3gpp'; break;
        case "3g2": mimeType = 'video/3gpp2'; break;
        case "mpeg": mimeType = 'video/mpeg'; break;
        case "mpg": mimeType = 'video/mpeg'; break;
        case "m4v": mimeType = 'video/x-m4v'; break;
        case "mov": mimeType = 'video/quicktime'; break;
        case "wmv": mimeType = 'video/x-ms-wmv'; break;
        default: mimeType = 'application/octet-stream';
    }

    console.log(`MimeType for extension ${ext}: ${mimeType}`);

    const video1 = {
        fileData: {
            mimeType: mimeType,
            fileUri: `gs://shothik/${filename}`
        }
    };

    const text1 = {
        text: `I want you to act as an Bengali language translator. I will provide a audio, you will determine which language speaker has spoken and translate it. Please do not not provide any further information, extra word and explanation`
    };

   
      const text2 = {text: `. Only provide  
      
      {
      \"name\":\"<name in Bangla>\",
      \"fathers_name\":\"<fathers name>\",
      \"mothers_name\":\"<mothers name>\", 
      \"accuracy\":\"<detection accuracy in percent like 95%>\"
      
      }`};


    const req = {
        contents: [
            { role: 'user', parts: [text1 ,video1, text2] }
        ],
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

    // console.log(data)
   



    console.log("Transcription data received");

    return {
        data: cleanStringToJson(data)
    }
}



