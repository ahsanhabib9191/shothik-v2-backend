// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');
const path = require('path');

// Creates a client
const client = new speech.SpeechClient();
const fs = require('fs');
const { KeyNoteFile } = require('../mongo/models/KeyNoteFile');
const { generateMeetingKeynote } = require('../vertext/vertext2');
const { TranscribeLongTextV2 } = require('./test');
const { meetingKeyNoteStatus } = require('../lib/pusher');

const gcsUri = 'gs://shothik/keynote/1708107670481.wav';


async function transcribeAudio(inputFile) {
  try {
      // Initialize a SpeechClient from the Google Cloud Speech library.
      const speechClient = new speech.SpeechClient();

      // Read the binary audio data from the specified file.

      // Read the binary audio data from the specified file.
        const file = fs.readFileSync(inputFile);
        const audioBytes = file.toString('base64');


      // Create an 'audio' object with the audio content in base64 format.
      const  audio  = {
          content: audioBytes
          // uri: gcsUri
      };

      // Define the configuration for audio encoding, sample rate, and language code.
      const config = {
          enableAutomaticPunctuation: true,
          encoding: 'LINEAR16',   // Audio encoding (change if needed).
          // sampleRateHertz: 48000, // Audio sample rate in Hertz (change if needed).
          languageCode: 'bn-BD',   // Language code for the audio (change if needed).
          model: "default"
      };

      // Return a Promise for the transcription result.
      return new Promise((resolve, reject) => {
          // Use the SpeechClient to recognize the audio with the specified config.
          speechClient.recognize({ audio, config })
              .then(data => {
                  resolve(data); // Resolve the Promise with the transcription result.
              })
              .catch(err => {
                  reject(err); // Reject the Promise if an error occurs.
              });
      });
  } catch (error) {
      console.error('Error:', error);
  }
}


async function transcribeSpeachToText(inputFile, keyNoteId, browserId) {
    try {
        console.log('Transcribing audio file to text...');
        var keyNote = await KeyNoteFile.findOne({ _id: keyNoteId });

        meetingKeyNoteStatus(browserId, {
            loading:true,
            message:"Extracting transcription from meeting"
        });

        // The path to the remote LINEAR16 file
        // process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'service_account.json');
        
        // const transcription = await TranscribeLongTextV2(keyNote.file);

        meetingKeyNoteStatus(browserId, {
            loading:true,
            message:"Saving transcription from meeting"
        });

        // keyNote.text = transcription;
        // keyNote.status = "success";
        // await keyNote.save();

        console.log('Keynote Generated ... ');
        await KeyNoteGenerator(keyNote?.text, keyNoteId);

        meetingKeyNoteStatus(browserId, {
            loading:false,
            message:"Finalized"
        });

        return true;
    } catch (error) {
        console.log('Error Found in transcribeSpeachToText:', error);
    }
}


async function KeyNoteGenerator(transcription, keyNoteId, browserId=null){
    try {
        console.log('Generating Keynote ... ');
        // Make Meeting Keynote of this text

        // generating keynote to pusher 
        meetingKeyNoteStatus(browserId, {
            loading:true,
            message:"Generating keynote..."
        });

        const meetingKeynote = await generateMeetingKeynote(transcription);
        
        meetingKeyNoteStatus(browserId, {
            loading:true,
            message:"saving keynote..."
        });

        // Save to DB
        var keyNote = await KeyNoteFile.findOne({ _id: keyNoteId });
        keyNote.keyNote = meetingKeynote;
        await keyNote.save(); 

        meetingKeyNoteStatus(browserId, {
            loading:false,
            message:"Saved Keynote"
        });

        return true;
    } catch (error) {
        return false;
    }
}


module.exports = {
    transcribeSpeachToText,
    KeyNoteGenerator
}

