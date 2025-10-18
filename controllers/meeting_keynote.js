const fs = require('fs');
const { KeyNoteFile } = require('../mongo/models/KeyNoteFile');
const { Storage } = require('@google-cloud/storage');

const serviceAccount = require('../cred/service_account.json');
const path = require('path'); // Add this line

// const ffmpeg = require('fluent-ffmpeg');
// ffmpeg -i temp_file.webm -vn -q:a 0 -map a out.wav
const { exec } = require('child_process');
const { transcribeSpeachToText, KeyNoteGenerator } = require('../transcribe/speach-to-text');
const { meetingKeyNoteStatus } = require('../lib/pusher');






function saveAudioFile(req, res){

    try {
        let sampleFile;
        let uploadPath;

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        const browserId = req.body.browserId;
        const transcribtion  = req?.body?.transcribtion;
      
        // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
        sampleFile = req.files.audioFile;

        const fileName = Date.now().toString()+"."+String(sampleFile.name).split('.')[1];
        uploadPath = __dirname + '/' + fileName;
        uploadPath = uploadPath.replace('controllers', 'uploads');

        // save to local 
        const outputPath = uploadPath.replace('.webm', '.wav');
        const command = `ffmpeg -i ${uploadPath} -vn -q:a 0 -map a ${outputPath}`;
        
        sampleFile.mv(uploadPath, async function(err) {
            
            if (err)return res.status(500).send(err);

            const uploadableFileName = String(fileName).replace('.webm', '.wav');

            // save to db
            const keyNote = await new KeyNoteFile({
                file: uploadableFileName,
                browserId: browserId,
                text: transcribtion,
            }).save();

            // Uploading file to GCLOUD
            await convertWebMToWav(command);
            await uploadToGoogleCloudStorage (outputPath, uploadableFileName, 'keynote/', browserId);

            // Delete file from local
            setTimeout(() => {
                fs.unlinkSync(uploadPath);
                fs.unlinkSync(outputPath);
            }, 15000);

            // Lets Transcribe
            // await transcribeSpeachToText("", keyNote?._id, browserId);
            await KeyNoteGenerator(transcribtion, keyNote?._id, browserId);

            // save status of keynote
            keyNote.status = 'success';
            keyNote.save();

            meetingKeyNoteStatus(browserId, {
                loading:false,
                message:"Finalizing"
            });
            
            return res.send('File uploaded!');
        });
    } catch (error) {
        return res.send({ error: error?.message })
    }

        // Upload file to GKE
}


async function convertWebMToWav(command) {
    return new Promise((resolve, reject) => {
        try {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    console.error('An error occurred:', err);
                    reject(err);
                }
                console.log('Conversion finished');
                resolve();
            });
        } catch (error) {
            console.error('Error converting file:', error);
            reject(error);
        }
    });
}



async function uploadToGoogleCloudStorage(outputPath, name, location, browserId) {
  
    return new Promise(async (resolve, reject) => {

        try {
            console.log(`Uploading to Google Cloud Storage: ${name}`);
    
            meetingKeyNoteStatus(browserId, {
                loading:true,
                message:"Saving  meeting to storage"
            });
    
            const storage = new Storage({
                keyFilename: path.join(__dirname, '..', 'cred', 'service_account.json') // Modify this line
            });
    
            const bucket = storage.bucket('shothik');
            const filename = `${location}${name}`;
            const file = bucket.file(filename);
            
            // take file from local and upload to gcloud
            const fileBuffer = fs.readFileSync(outputPath);
    
            try {
                await file.save(fileBuffer, {
                    metadata: { contentType: 'audio/wav' },
                });
    
                const [metadata] = await file.getMetadata();
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    
                console.log('Uploaded: Done');
                console.log('Public URL:', publicUrl);
                resolve(publicUrl);
    
            } catch (error) {
                console.error(`Error on Finished: ${error}`);
                // throw new Error('Error uploading image to Google Cloud Storage');
                resolve();
            }
        } catch (error) {
            console.error('Error uploading image to Google Cloud Storage:', error);
            // throw new Error('Error uploading image to Google Cloud Storage');
        }


    });
}



async function reGenerateKeyNoteController(req, res){
    try {
        const  { id } = req.params;
        const browserId = req.query.browserId;

        const note = await KeyNoteFile.findOne({_id: id});
        await transcribeSpeachToText(null, note._id, browserId);
      
        return res.json(note)
    } catch (error) {
            
        }
}



// extract text from audio file

async function KeyNotesController(req, res){
    try {
        const  { browserId } = req.params;
        const keyNotes = await KeyNoteFile.find({browserId}).sort({_id: -1}).select('-text -keyNote');
        return res.json(keyNotes)
    } catch (error) {
        
    }
}

async function KeyNoteByIdController(req, res){
    try {
        const  { id } = req.params;
        const note = await KeyNoteFile.findOne({_id: id});

        // check keynote
        // if keynote contain any english word 
        const isEnglish = /[A-Za-z]/.test(note.text);
        if(isEnglish){
            // translate to bangla
            await KeyNoteGenerator(note.text, note._id);
        }



        return res.json(note)
    } catch (error) {
        
    }
}



module.exports = {
    saveAudioFile,
    KeyNotesController,
    KeyNoteByIdController,
    reGenerateKeyNoteController
}