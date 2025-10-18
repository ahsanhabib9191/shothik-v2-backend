const speech = require('@google-cloud/speech').v1p1beta1;
const path = require('path');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const axios = require('axios');
// const gcsUri = 'gs://shothik/keynote/1708107816399.wav';

var SPEECH_KEY = "e0ce6fb0af53450ab34eea3e92357cd0";
var SPEECH_REGION = "eastasia"; // e.g., "westus"



// The path to the remote LINEAR16 file
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'service_account.json');

// Creates a client
const client = new speech.SpeechClient();

const config = {
  encoding: 'LINEAR16',
  languageCode: 'bn-BD',
  audioChannelCount: 1,
  enableSeparateRecognitionPerChannel: true,
  sampleRateHertz: 48000,
  alternativeLanguageCodes: ['bn-BD', 'en-US'],
};



// async function TranscribeLongTextV2(fileName){

//         try {

//             const gcsUri = `gs://shothik/keynote/${fileName}`;

//             const audio = {
//                 uri: gcsUri,
//               };
              
//             const request = {
//                 config: config,
//                 audio: audio,
//             };

//             console.log('starting ....');
//             const [operation] = await client.longRunningRecognize(request);
//             console.log('Req sent to server');
//             // Get a Promise representation of the final result of the job
//             const [response] = await operation.promise();
//             var output = "";
//             response.results.forEach(result => {
//                 output += `${result.alternatives[0].transcript}`;
//             });

//             console.log('new output', output)

//             return output;

//         } catch (error) {
//             console.log('Error', error);
//             return "";
            
//         }

    
// };



function AzureTranscribe(filename) {
    return new Promise((resolve, reject) => {
        try {

            const filePath = path.join(__dirname, filename);
            const file = fs.readFileSync(filePath);

            const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
            speechConfig.speechRecognitionLanguage = "bn-IN";
            let audioConfig = sdk.AudioConfig.fromWavFileInput(file);
            let speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
            console.log("Recognizing from file...");
            speechRecognizer.recognizeOnceAsync(result => {
                switch (result.reason) {
                    case sdk.ResultReason.RecognizedSpeech:
                        return resolve(result.text);
                    case sdk.ResultReason.NoMatch:
                        
                        return resolve("Please try again letter 2");
                    case sdk.ResultReason.Canceled:
                        // const cancellation = sdk.CancellationDetails.fromResult(result);
                        return resolve("Please try again letter 3");
                }
                speechRecognizer.close();
            });

        } catch (error) {
            console.log(error);
            resolve("Please try again letter");
        }
    });
}



async function trans(filename){
    // create the push stream we need for the speech sdk.
    var pushStream = sdk.AudioInputStream.createPushStream();

    const filePath = path.join(__dirname, filename);
            // const file = fs.readFileSync(filePath);

    // open the file and push it to the push stream.
    fs.createReadStream(filePath).on('data', function(arrayBuffer) {
    pushStream.write(arrayBuffer.slice());
    }).on('end', function() {
    pushStream.close();
    });

    // we are done with the setup
    console.log("Transcribing from: " + filename);
    // now create the audio-config pointing to our stream and
    // the speech config specifying the language.
    var speechConfig = sdk.SpeechConfig.fromSubscription('e0ce6fb0af53450ab34eea3e92357cd0', 'eastasia');
    var audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    // create the conversation transcriber.
    var transcriber = new sdk.ConversationTranscriber(speechConfig, audioConfig);
    transcriber.speechRecognitionLanguage = "bn-IN";

    transcriber.sessionStarted = function(s, e) {
        console.log("(sessionStarted) SessionId:" + e.sessionId);
    };
    transcriber.sessionStopped = function(s, e) {
        console.log("(sessionStopped) SessionId:" + e.sessionId);
    };
    transcriber.canceled = function(s, e) {
        console.log("(canceled) " + e.errorDetails);
    };
    transcriber.transcribed = function(s, e) {
        console.log("(transcribed) text: " + e.result.text);
        console.log("(transcribed) speakerId: " + e.result.speakerId);
    };

    // Begin conversation transcription
    transcriber.startTranscribingAsync(
        function () {},
        function (err) {
            console.trace("err - starting transcription: " + err);
        }
    );
}


// trans('1709000647416.wav').then((res) => {
//     console.log('data:', res);
// }).catch((err) => {
//     console.log('AzureTranscribe:', err);
// })

// file download from gcloud with axios
function FileDownload(filename) {
    return new Promise((resolve, reject) => {
        try {
            // download file from gcloud
            axios({
                method: 'get',
                url: `https://storage.googleapis.com/shothik/keynote/${filename}`,
                responseType: 'stream'
            }).then(function (response) {
                // Save the file to the directory where this script resides
                const filePath = path.join(__dirname, filename);
                const fileStream = fs.createWriteStream(filePath);
                response.data.pipe(fileStream);
                fileStream.on('finish', function () {
                    resolve(filePath); // Resolve with the file path once it's saved
                });
                fileStream.on('error', function (err) {
                    reject(err); // Reject if there's an error while saving the file
                });
            });
        } catch (error) {
            reject(error);
        }
    }
)}




async function TranscribeLongTextV2(fileName){
    try {
        await FileDownload(fileName);
        const transcription = await AzureTranscribe(fileName);
        unLinkFile(fileName);
        return transcription;
    } catch (error) {
        console.log('Error on TranscribeLongTextV2:', error);
    }

}


function unLinkFile(fileName){
    try {
        if(fileName){
            setTimeout(() => {
                // delete the file from current directory
                try {
                    const filePath = path.join(__dirname, fileName);
                    fs.unlinkSync(filePath);
                } catch (error) {
                    // 
                }
            }, 2000);
        }
    }catch(error){
        // console.log('Error on delete file:');
    }
}



module.exports = {
    TranscribeLongTextV2
}