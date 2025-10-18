const path = require('path');
const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { CLOUD_BUCKET } = require("../config/constant");
const { deleteLocalFile, convertVideoToMp3, convertDocToText } = require('../controllers/transcription.helper');
require('colors');

const storage = new Storage({
    keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json'),
});

const bucket = storage.bucket(CLOUD_BUCKET);

function isValidFileType(ext) {
  const supportedTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', '3gp', '3g2', 'mpeg', 'mpg', 'm4v'];
  return supportedTypes.includes(ext.toLowerCase());
}

const fileUpload = async (req, res, next) => {
  console.log("Filetranscription function started");

  if (!req.files || Object.keys(req.files).length === 0) {
      console.log("No files were uploaded");
      return res.status(400).send('No files were uploaded.');
  }

  if (!req.files.file) {
      console.log("File name not found in the request");
      return res.status(400).send('file name not found');
  }

  const name = req.files.file.name;
  let ext = String(name).split('.').pop();
  let uploadPath = path.join(__dirname, '..', 'uploads', name);

  if (!isValidFileType(ext)) {
      console.log("Unsupported file type");
      return res.status(400).send({success: false, error: "UNSUPPORTED", message: 'Unsupported file type.'});
  }
  const language = req.body.language;
  const file = req.files.file;
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
    if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv" || ext === "flv" || ext === "wmv" || ext === "mpg" || ext === "mpeg" || ext === "3gp" || ext === "webm") {
        await convertVideoToMp3(uploadPath , name);
        originalFile = uploadPath
        uploadPath = uploadPath.replace('.' + ext, '.mp3');
        console.log(`Upload path: ${uploadPath}`);

        // config
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
            metadata: { contentType: `doc/${ext}` },
        });

        const [metadata] = await file.getMetadata();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
        console.log(`File uploaded. Public URL: ${publicUrl}`);

        // Remove file from local
        deleteLocalFile(uploadPath, originalFile);

         
        req.url=publicUrl;
        req.filename = filename;
        req.ext = ext;
        req.fileMeta = metadata;
        next()

      } catch (error) {
        console.error(`Error on Finished: ${error}`);
        saveErrorLog(error.message, 'high', {language, file }, 'file_upload');
        return res.status(500).send('Error uploading image to Google Cloud Storage');
      }
  });
};

module.exports = fileUpload;
