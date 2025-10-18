const path = require('path');
const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const { CLOUD_BUCKET } = require("../config/constant");
const { convertDocToText } = require('../controllers/transcription.helper');
require('colors');

const storage = new Storage({
    keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json'),
});

const bucket = storage.bucket(CLOUD_BUCKET);

function isValidFileType(ext) {
  const supportedTypes = ['doc', 'docx'];
  return supportedTypes.includes(ext.toLowerCase());
}

const docConverter = async (req, res, next) => {
  console.log("File Transcription function started");

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
  const file = req.files.file;

  file.mv(uploadPath, async function(err) {
    if (err) {
        console.error("Error moving file:", err);
        return res.status(500).send(err);
    }

    const text = await convertDocToText(uploadPath , name);
    const convertedText = text;
    req.convertedText = convertedText
    fs.unlinkSync(uploadPath);
    next();
  });
};

module.exports = docConverter;
