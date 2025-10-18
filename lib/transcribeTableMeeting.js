const fs = require('fs');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { AZURE_SUBSCRIPTION_KEY, AZURE_SPEECH_REGION } = require("../config/constant");

const subscriptionKey = AZURE_SUBSCRIPTION_KEY;
const serviceRegion = AZURE_SPEECH_REGION;

// Function to transcribe audio
const transcribeTableMeeting = async (audioPath) => {
    return new Promise((resolve, reject) => {
        try {
            const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
            const audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(audioPath));
            const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

            recognizer.recognizeOnceAsync(
                (result) => {
                    if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                        resolve(result.text);
                    } else {
                        reject(new Error(`Speech recognition failed: ${result.reason}`));
                    }
                    recognizer.close();
                },
                (err) => {
                    reject(err);
                    recognizer.close();
                }
            );
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    transcribeTableMeeting
};