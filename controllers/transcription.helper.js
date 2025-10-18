const { exec } = require('child_process');
// Upload Video 
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');

if (os.platform() === 'win32') {
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log("Using ffmpeg from @ffmpeg-installer on Windows");
} else {
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
  console.log("Using system-installed ffmpeg on Linux/Docker");
}

const mammoth = require('mammoth');
const { htmlToText } = require('html-to-text');
// const pdfParse = require('pdf-parse');

async function convertVideoToMp3( uploadPath, name) {
    try {
        console.log('Converting video to mp3');

        const outputPath = uploadPath.replace(path.extname(name), '.mp3');

        return new Promise((resolve, reject) => {
            ffmpeg(uploadPath)
                .inputOptions('-vn') // Ensure no video is processed
                .audioCodec('libmp3lame') // Set the audio codec to MP3
                .outputOptions([
                    '-qscale:a 5', // Set the audio quality scale for high compression
                    '-fflags +genpts', // Generate missing PTS if needed
                    '-avoid_negative_ts make_zero' // Avoid negative timestamps
                ])
                .format('mp3') // Ensure the output format is MP3
                .on('end', () => {
                    console.log('MP3 conversion finished');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error converting video to MP3:', err);
                    reject(err);
                })
                .save(outputPath);
        });

    } catch (error) {
        console.error('Error converting video to mp3:', error);
    }

    
    
}

async function convertDocToText( uploadPath, name) {
    try {
        console.log('Converting doc to text');
        const fileExtension = name.split('.').pop().toLowerCase();

        let text;
        if (fileExtension === 'docx') {
            const { value: html } = await mammoth.convertToHtml({ path: uploadPath });

            text = htmlToText(html, {
                wordwrap: 130
            });

            fs.unlinkSync(uploadPath);
        }else {
            throw new Error('Unsupported file type');
        }

        const numberRegex = /[০-৯0-9]/g;
        const symbolRegex = /[*#\-]/g;
        const newlineRegex = /\n/g;
        const colonRegex = /:/g;
        const noiseRegex = /<noise>/g;

        const cleanString = text && text
            .replace(numberRegex, '')
            .replace(symbolRegex, '')
            .replace(newlineRegex, '')
            .replace(colonRegex, '')
            .replace(noiseRegex, '');

        return cleanString
    } catch (error) {
        console.error('Error converting doc to text:', error);
    }
    
}



// execute convertCommand 
async function executeCommand(command) {
    return new Promise((resolve, reject) => {
        try {
            exec(command, (err, stdout, stderr) => {

                console.log('stdout:', stdout, 'stderr:', stderr, 'command:', command, err);

                if (err) {
                    console.error('An error occurred:', err);
                    reject(err);
                }
                console.log('Conversion finished');
                resolve();
            });
            console.log('Conversion started');
        } catch (error) {
            console.error('Error converting file:', error);
            reject(error);
        }
    });
}

function deleteLocalFile(uploadPath, originalFile){
    try {
        fs.unlinkSync(uploadPath);
        console.log("Local file deleted");

        if(originalFile){
            fs.unlinkSync(originalFile);
            console.log("Original file deleted");
        }

        // delete all files from this folder    
        // deleteAllFiles(uploadPath);
       
    } catch (error) {
        console.log('Error deleting local file', error);
    }
}

function deleteAllFiles(uploadPath) {
    // remove last file name with extension to access the folder 
   try {
    
        // remove last file name with extension to access the folder
        const folderName = uploadPath.split('/').pop();
        const folderPath = uploadPath.replace(folderName, '');

        const files = fs.readdirSync(folderPath);
        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            if (fs.lstatSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
        });
   } catch (error) {
    
   }

}
    


function cleanStringToJson(inputString) {
    
    // Check if the inputString object contains the 'data' key
    if (!inputString) {
        console.error('Invalid input format: "data" key not found');
        return { message: 'Invalid input format' };
    }

    // Extracting the value of the "data" key
    var txt = inputString;

    if(String(txt).startsWith('```json\n')){
        txt = String(txt).replace('```json\n', '');
    }

    txt  = String(txt).replace('\n```\n', '');


    // Remove extra spaces and quotes
    let cleanedString = String(txt).replace(/\s+/g, ' ');

    // Replace backslashes
    cleanedString = String(cleanedString).replace(/\\/g, '');

    let response = {};
    // Parse the cleaned string to JSON
    try {
        response = JSON.parse(cleanedString);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        response = { message: "Having trouble to process" };
    }

    return response;
}


module.exports = {
    deleteLocalFile,
    executeCommand,
    convertVideoToMp3,
    cleanStringToJson,
    convertDocToText,
}