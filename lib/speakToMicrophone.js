const sdk = require('microsoft-cognitiveservices-speech-sdk');

function speakToMicrophone(apiKey, region) {
    console.log("Speak into your microphone. Say 'stop session' to end.");

    const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region);
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const recognizeOnce = () => {
        recognizer.recognizeOnceAsync(
            (result) => {
                if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                    console.log(`Recognized: ${result.text}`);
                    if (result.text.toLowerCase().includes('stop session')) {
                        console.log("Session ended by user.");
                        recognizer.close();
                        return;
                    }
                } else if (result.reason === sdk.ResultReason.NoMatch) {
                    console.log(`No speech could be recognized: ${result.noMatchDetails}`);
                } else if (result.reason === sdk.ResultReason.Canceled) {
                    const cancellation = sdk.CancellationDetails.fromResult(result);
                    console.log(`Speech Recognition canceled: ${cancellation.reason}`);
                    if (cancellation.reason === sdk.CancellationReason.Error) {
                        console.log(`Error details: ${cancellation.errorDetails}`);
                        console.log("Did you set the speech resource key and region values?");
                    }
                }
                // Continue listening
                recognizeOnce();
            }
        );
    };

    recognizeOnce();
}

module.exports = {
    speakToMicrophone
};
