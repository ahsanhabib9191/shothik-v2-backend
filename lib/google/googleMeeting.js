const fs = require("fs");
const path = require("path");
const {google} = require("googleapis");
const sdk = require('microsoft-cognitiveservices-speech-sdk');
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

const { CHROME_PATH, AZURE_SUBSCRIPTION_KEY, AZURE_SPEECH_REGION, MEETING_DURATION } = require("../../config/constant");
const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
stealthPlugin.enabledEvasions.delete("media.codecs");
puppeteer.use(stealthPlugin);
const { launch, getStream, wss } = require("puppeteer-stream");
const { MeetingModel } = require('../../mongo/models/meetingMinute');
const { ScheduleEvent } = require('../../mongo/models/ScheduleEvent');
const { TranscriptionModel } = require('../../mongo/models/Transcription');
const { uploadToGCS } = require('../uploadToGCS');
const { ConvertTextToMeeting } = require('../ConvertTextToMeeting');
const { MeetingSettingsModel } = require('../../mongo/models/MeetingSettings');
const { getOAuth2Client } = require('../getOAuth2Client');
const { sendMultipleMultipleEmail } = require('../sendMultipleMultipleEmail');
const { PermissionModel } = require('@ridz-shothikai/shothik-auth-service/src/models/Permission');
const { SpacesServiceClient, ConferenceRecordsServiceClient } = require('@google-apps/meet').v2;

const activeMeetings = new Map();

const joinGoogleMeeting = async (meetLink, email, password, userId) => {
  const meetingTimeOut = 1000 * 60 * parseInt(MEETING_DURATION);
  const isLinux = os.platform() === "linux";
  let browser;
  let stream;
  const outputDir = path.join(__dirname, '..', '..', 'uploads', `${userId}`);
  const videoOutputFile = path.join(outputDir, `${uuidv4()}.webm`);

  await fs.promises.mkdir(outputDir, { recursive: true });
  const file = fs.createWriteStream(videoOutputFile);

  try {
    browser = await launch(puppeteer, {
      headless: 'new',
      executablePath: isLinux ? CHROME_PATH : 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args: [
        '--use-fake-device-for-media-stream',
        '--ignore-certificate-errors',
        '--enable-features=ChromeBrowserCloudManagement',
        '--disable-notifications',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
      ],
      ignoreDefaultArgs: ['--mute-audio'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 720 });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(meetLink, ['camera', 'microphone']);

    await loginToGoogle(page, email, password);
    await joinMeeting(page, meetLink);

    let isVideo = false;
    try {
      const data = await MeetingSettingsModel.findOne({ user: userId });
      isVideo = data?.recordVideo || false;
    } catch (error) {
      console.log('No video element found');
    }

    console.log("Joined the meeting in background");

    stream = await getStream(page, { audio: true, video: isVideo });

    console.log("Video recording", isVideo);

    stream.pipe(file);

    const getParticipantNames = async () => {
      return await page.evaluate(() => {
        const nameElements = document.querySelectorAll('.zWGUib');
        return Array.from(nameElements).map(element => element.textContent.trim());
      });
    };

    const checkParticipantCount = async () => {
      const participantCount = await page.evaluate(() => {
        const element = document.querySelector('.gFyGKf.BN1Lfc .uGOf1d');
        return element ? parseInt(element.textContent, 10) : 0;
      });
      return participantCount;
    };

    let lowParticipantStartTime = null;
    let isMeetingClosed = false;
    let participants;

    const closeMeetingAndTranscribe = async (reason) => {
      if (isMeetingClosed) return;
      isMeetingClosed = true;

      console.log(`Closing meeting due to: ${reason}`);
      clearInterval(checkAndCloseInterval);
      clearTimeout(timeoutTimer);

      stream.destroy();
      await page.close();
      await browser.close();
      file.close();
      console.log("Meeting closed and recording stopped.");

      // Remove from active meetings
      activeMeetings.delete(userId);

      // Initiate transcription and processing
      await processRecording(videoOutputFile, userId, meetLink, participants);
    };

    // Define stop function
    const stopMeetingFunction = () => closeMeetingAndTranscribe("Manual stop requested");

    // Store stop function in active meetings
    activeMeetings.set(userId, stopMeetingFunction);

    const checkAndCloseInterval = setInterval(async () => {
      const count = await checkParticipantCount();
      console.log(`Current participant count: ${count}`);

      try {
        participants = await getParticipantNames();
        console.log(`Participants:`, participants);
      } catch (error) {
        console.error('Error getting participant names:', error);
      }

      if (count < 2) {
        if (!lowParticipantStartTime) {
          lowParticipantStartTime = Date.now();
        } else if (Date.now() - lowParticipantStartTime >= 2 * 60 * 1000) {
          await closeMeetingAndTranscribe("Less than 2 participants for 2 minutes");
        }
      } else {
        lowParticipantStartTime = null;
      }
    }, 10000);

    const timeoutTimer = setTimeout(async () => {
      await closeMeetingAndTranscribe("Meeting duration reached");
    }, meetingTimeOut);

  } catch (error) {
    console.error("Error in joinGoogleMeeting:", error.message);

  }
};


const processRecording = async (videoOutputFile, userId, meetLink, participants) => {
  try {
    const participantsList = participants.filter(part => !part.toLowerCase().includes('shothik'));

    // Convert and transcribe the file
    const { transcription, audioUrl, videoUrl, event, attendees } = await convertAndTranscribe(videoOutputFile, userId, meetLink, participantsList);
    // Get all schedules for the user
    const platform = 'google-meet';
    // Convert text to meeting minute
    const mainText = transcription ? transcription.text : '';

    let transcribeMeeting = '';
    const numberRegex = /[০-৯0-9]/g;
    const symbolRegex = /[*#.\-]/g;
    const newlineAfterColonRegex = /:(\n+)/g;
    const newlineRegex = /\n+/g;
    const noiseRegex = /<noise>/g;

    if (mainText) {
      const meetingData = await ConvertTextToMeeting(mainText);
        transcribeMeeting =
        meetingData &&
        meetingData.data
          .replace(numberRegex, "")
          .replace(symbolRegex, "")
          .replace(newlineAfterColonRegex, "")
          .replace(newlineRegex, "")
          .replace(noiseRegex, "")
          .replace(/```html|```/g, "");
    }

    console.log("Generate success, sending response");
    // Save all data to DB
    const { data, error } = await saveDataToDb({ userId, platform, attendees, event, transcription, transcribeMeeting, audioUrl, videoUrl });

    if (!data) {
      console.error('Failed to save data to DB:', error);
      return;
    }

    console.log('Data saved to DB')
  } catch (error) {
    console.error("Error during recording processing and DB operations:", error);
  }
};

const convertAndTranscribe = async (videoPath, userId, meetLink, participants) =>{
  try {
    console.log('Starting conversion and transcription process');

    // Convert to wav
    const wavPath = await convertToWav(videoPath);

    // Get all schedules for the user
    const schedules = await getGoogleMeetSchedule(userId);

    let attendees;
    let event;
    if (schedules) {
      // Find the event matching the Google Meet link
      event = schedules?.find(ev => ev.hangoutLink === meetLink);
      // Get all attendees
      attendees = event?.attendees?.map(person => person?.email);

    }

    // Transcribe the wav
    const transcription = await transcribeAudio(wavPath, userId, participants);

    // Upload audio file to GCS
    const audioFileName = path.basename(wavPath);
    const audioUrl = await uploadToGCS(wavPath, audioFileName);
    console.log('Audio uploaded to GCS:', audioUrl);

    // Upload video file to GCS
    const videoFileName = path.basename(videoPath);
    const videoUrl = await uploadToGCS(videoPath, videoFileName);
    console.log('Video uploaded to GCS:', videoUrl);

    // Clean up the temporary files
    fs.unlink(wavPath, (err) => {
      if (err) {
        console.error('Failed to delete the audio file:', err);
      } else {
        console.log('Audio file deleted successfully');
      }
    });

    fs.unlink(videoPath, (err) => {
      if (err) {
        console.error('Failed to delete the video file:', err);
      } else {
        console.log('Video file deleted successfully');
      }
    });

    return { transcription, audioUrl, videoUrl, event, attendees };

    } catch (error) {
    console.error('Error in convertAndTranscribe:', error);
    throw error;
  }
}

const transcribeAudio = async (audioFilePath, userId, participants) => {
  console.log('Start Transcribing...........')
  const subscriptionKey = AZURE_SUBSCRIPTION_KEY;
  const serviceRegion = AZURE_SPEECH_REGION;

  if (!subscriptionKey || !serviceRegion) {
    console.error('Azure subscription key or region not set. Please check your environment variables.');
    return;
  }

  let language = 'en-US';
  try {
    const data = await MeetingSettingsModel.findOne({ user: userId });
    if (data && data.meetingLanguage) {
      const languageSetting = data.meetingLanguage.toLowerCase();
      switch (languageSetting) {
        case 'bengali':
          language = 'bn-In';
          break;
        case 'bangla':
          language = 'bn-In';
          break;
        case 'english':
          language = 'en-US';
          break;
        default:
          language = 'en-US';
          break;
      }
    }
  } catch (error) {
    console.error('Error in getting language:', error.message);
  }

  const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
  speechConfig.speechRecognitionLanguage = language

  let audioConfig;
  if (audioFilePath.endsWith('.wav')) {
    audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(audioFilePath));
  } else {
    const pushStream = sdk.AudioInputStream.createPushStream();
    fs.createReadStream(audioFilePath).on('data', arrayBuffer => {
      pushStream.write(arrayBuffer.slice());
    }).on('end', () => {
      pushStream.close();
    });
    audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  }

  let conversationTranscriber = new sdk.ConversationTranscriber(speechConfig, audioConfig);

  const speakers = participants;
  
  // Create a mapping of speakerIds to actual names
  const speakerMap = new Map();
  
  return new Promise((resolve, reject) => {
    let conversations = [];
    let text = '';

    conversationTranscriber.transcribing = (s, e) => {
      console.log(`TRANSCRIBING: Text=${e.result.text}`);
    };

    conversationTranscriber.transcribed = (s, e) => {
      if (e.result.reason == sdk.ResultReason.RecognizedSpeech) {
        console.log(`TRANSCRIBED: Text=${e.result.text}`);

        text += ` ${e.result.text}`;

        // Get or assign speaker name
        let speakerName;
        if (speakerMap.has(e.result.speakerId)) {
          speakerName = speakerMap.get(e.result.speakerId);
        } else {
          // Assign a new speaker name based on the next available index
          const nextIndex = speakerMap.size;
          if (speakers && speakers[nextIndex]) {
            speakerName = speakers[nextIndex];
          } else {
            speakerName = `Speaker ${nextIndex + 1}`;
          }
          speakerMap.set(e.result.speakerId, speakerName);
        }

        conversations.push({
          name: speakerName,
          text: e.result.text,
          time: `${formatDuration(e.result.offset)} - ${formatDuration(e.result.offset + e.result.duration)}`
        });
      }
      else if (e.result.reason == sdk.ResultReason.NoMatch) {
        console.log("NOMATCH: Speech could not be transcribed.");
      }
    };

    conversationTranscriber.canceled = (s, e) => {
      console.log(`CANCELED: Reason=${e.reason}`);
      if (e.reason == sdk.CancellationReason.Error) {
        console.log(`CANCELED: ErrorCode=${e.errorCode}`);
        console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
        console.log("CANCELED: Did you set the speech resource key and region values?");
      }
      conversationTranscriber.stopTranscribingAsync();
    };

    conversationTranscriber.sessionStopped = (s, e) => {
      console.log("Session stopped event.");
      conversationTranscriber.stopTranscribingAsync(() => {
        console.log('Transcription stopped');
        resolve({ text, conversations });
      }, (err) => {
        console.error('Error stopping transcription:', err);
        reject(err);
      });
    };

    conversationTranscriber.startTranscribingAsync(() => {
      console.log('Transcription started');
    });

    // // Stop transcription after 30 seconds or adjust as needed
    // setTimeout(() => {
    //   conversationTranscriber.stopTranscribingAsync(
    //     () => {
    //       console.log('Transcription stopped');
    //       resolve({ text, conversations });
    //     },
    //     (err) => {
    //       console.error(err);
    //       reject(err);
    //     }
    //   );
    // }, 1000 * 30);
  });
}

const loginToGoogle =  async (page, email, password) => {
  await page.goto("https://accounts.google.com/signin", {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', email, {delay: 100});
  await page.click("#identifierNext");

  await page.waitForSelector('input[type="password"]', {visible: true});
  await page.type('input[type="password"]', password, {delay: 100});
  await page.click("#passwordNext");

  await page.waitForNavigation({waitUntil: "networkidle2"});
}

const joinMeeting = async (page, meetLink) => {
  const maxAttempts = 3;
  let attempts = 0;
  let joined = false;

  while (attempts < maxAttempts && !joined) {
    try {
      attempts++;
      console.log('Attempt...', attempts);

      await page.goto(meetLink, { waitUntil: "networkidle2" });

      await muteMicrophone(page);
      await turnOffCamera(page);

      await page.waitForSelector('button[jsname="Qx7uuf"]', {
        visible: true,
        timeout: 60000,
      });
      await page.click('button[jsname="Qx7uuf"]');

      console.log("Joined the meeting");

      await new Promise(resolve => setTimeout(resolve, 5000));

      await muteMicrophone(page);

      console.log("Microphone status checked and muted if necessary after joining");

      await page.screenshot({ path: `meeting-joined-attempt-${attempts}.png` });

      await new Promise(resolve => setTimeout(resolve, 5000));

      await page.waitForSelector('button[aria-label="People"]', {
        visible: true,
        timeout: 10000,
      });

      // Click the button
      await page.click('button[aria-label="People"]');

      joined = true;
    } catch (error) {
      console.error(`Attempt ${attempts} failed:`, error.message);
      
      if (attempts === maxAttempts) {
        console.error('All attempts to join the meeting have failed');
        throw new Error('Failed to join meeting after maximum attempts');
      }
      
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

const muteMicrophone =  async (page) => {
  const microphoneButton = await page.$('div[jsname="BOHaEe"][data-is-muted="false"]');
  if (microphoneButton) {
    await microphoneButton.click();
    console.log("Microphone muted");
  } else {
    console.log("Microphone is already muted");
  }
}

const turnOffCamera =  async (page) => {
  const cameraButton = await page.$('div[jsname="BOHaEe"][data-is-muted="false"]');
  if (cameraButton) {
    await cameraButton.click();
    console.log("Camera turned off");
  } else {
    console.log("Camera is already off");
  }
}

const convertToWav = async (videoPath) =>{
    console.log('Converting to WAV');
    const outputPath = videoPath.replace(path.extname(videoPath), '.wav');

    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .inputOptions('-vn') // Ensure no video is processed
            .audioCodec('pcm_s16le') // Set the audio codec to PCM 16-bit
            .outputOptions([
                '-ar 16000', // Set audio sample rate to 16kHz for better speech recognition
                '-ac 1', // Set to mono channel
            ])
            .format('wav')
            .on('end', () => {
                console.log('WAV conversion finished');
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('Error converting to WAV:', err);
                reject(err);
            })
            .save(outputPath);
    });
}

// Helper function to format duration
const formatDuration = (durationInTicks)=> {
  const seconds = Math.floor(durationInTicks / 10000000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// create google meet event
const createGoogleMeetEvent = async (eventData, userId) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Initialize the Google Calendar API
    const oauth2Client = await getOAuth2Client(user)

  
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Add the default guest user if not already in attendees
    if (!eventData.attendees.some(attendee => attendee.email === 'shothik@shothik.ai')) {
      eventData.attendees.push({ email: 'shothik@shothik.ai' });
    }

    // Create the event with Google Meet link
    const event = await calendar.events.insert({
      calendarId: 'primary',
      resource: {
        ...eventData,
        creator: { email: user.email },
        organizer: { email: user.email },
      },
      conferenceDataVersion: 1,
    });

    return event;
  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

// Get Google schedule meeting
const getGoogleMeetSchedule = async (userId) =>{
    try {
        const user = await User.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        const permission = await PermissionModel.findOne({ user: userId });
   
        if (!permission) {
          throw new Error('permission not found');
        }

        const oauth2Client = await getOAuth2Client(user)

        // Use Calender API
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const response = await calendar.events.list({
            calendarId: permission.google.email,
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items;
        if (events.length) {
            events.forEach((event) => {
                const start = event.start.dateTime || event.start.date;
                console.log(`- ${start} ${event.summary}`);
            });
            return events;
        } else {
            console.log('No upcoming events found.');
            return [];
        }
              
    } catch (error) {
        console.error('Error fetching events:', error);
        throw error; 
    }
}

const saveDataToDb = async ({userId, platform, attendees, event, transcription, transcribeMeeting  , audioUrl, videoUrl})=>{
   try {
      // Create meeting minute data
      const meetingMinute = await MeetingModel.create({
          title: event?.summary || 'Table meeting by Shothik AI',
          author: userId,
          platform: platform,
          participants: attendees,
          media: audioUrl,
          media_video: videoUrl,
          transcribeData: transcribeMeeting || "",
          type: 'online',
      })

      // Create schedule event data
      const updateScheduleData = {
          user: userId,
          ...event,
          meeting: meetingMinute._id
      }

      const scheduleData = await ScheduleEvent.create(updateScheduleData)

      // Create transcribe event data
      const transcribeData = {
        text: transcription.text || '',
        summary: '',
        conversations: transcription.conversations,
        meeting: meetingMinute._id,
        status: 'complete'
      }

      const transcriptionData = await TranscriptionModel.create(transcribeData)

      // Update final meeting minute
     const result =  await MeetingModel.findByIdAndUpdate(meetingMinute._id, {
          eventData: scheduleData._id,
          transcription: transcriptionData._id
      })

      console.log('Meeting minute updated with schedule and transcription data ID:', meetingMinute._id);

      sendMultipleMultipleEmail({emails: attendees, title: `${event?.summary} || 'Online meeting'`, transcribeData: transcribeMeeting})

      return { data: result };

   } catch (error) {
    console.log(error)
    return { data: null, error: error.message };
   }
}


// ==============================Google Meet API======================================
const generateGoogleSpace = async (userId) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oauth2Client = await getOAuth2Client(user)

    const meetClient = new SpacesServiceClient({
      authClient: oauth2Client
    });

    // Construct request
    const request = {};

    // Run request
    const data = await meetClient.createSpace(request);

    return {data}

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleSpace = async (userId, name) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (!name) {
      throw new Error('Name not found');
    }

    const oauth2Client = await getOAuth2Client(user)


    const meetClient = new SpacesServiceClient({
      authClient: oauth2Client
    });

    // Construct request
    const request = {
      name
    };

    // Run request
    const data = await meetClient.getSpace(request);

    return {data}

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleConferenceList = async (userId) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oauth2Client = await getOAuth2Client(user)

    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

   // Construct request
    const request = {};

    // Run request
    const data = [];
    const iterable = meetClient.listConferenceRecordsAsync(request);
    for await (const response of iterable) {
      data.push(response);
    }

    // Return the retrieved data
    return { data };

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleSingleConference = async (userId, name) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

   // Construct request
    const request = {
      name,
    };

    // Run request
    const data = await meetClient.getConferenceRecord(request);

    return {data}
    
  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleRecordList = async (userId, parent) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if(!parent){
      throw new Error('Parent is required');
    }

    const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      parent
    };

    // Run request
    const data = [];
    const iterable = meetClient.listRecordingsAsync(request);
    for await (const response of iterable) {
        data.push(response);
    }

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleRecord = async (userId, name) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!name) {
      throw new Error('name not found');
    }

    const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      name
    };

    // Run request
    const data = await meetClient.getRecording(request);

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleParticipantList = async (userId, parent) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if(!parent){
      throw new Error('Parent is required');
    }

    const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      parent
    };

    // Run request
    const data = [];
    const iterable = meetClient.listParticipantsAsync(request);
    for await (const response of iterable) {
        data.push(response);;
    }

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleParticipant = async (userId, name) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!name) {
      throw new Error('name not found');
    }

   const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      name
    };

    // Run request
    const data = await meetClient.getParticipant(request);

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleTranscriptList = async (userId, parent) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if(!parent){
      throw new Error('Parent is required');
    }

    const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      parent
    };

    // Run request
    const data = [];
    const iterable = meetClient.listTranscriptsAsync(request);
    for await (const response of iterable) {
        data.push(response);;
    }
 
    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleTranscript = async (userId, name) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!name) {
      throw new Error('name not found');
    }

   const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      name
    };

    // Run request
    const data = await meetClient.getTranscript(request);

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleParticipantSessionList = async (userId, parent) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if(!parent){
      throw new Error('Parent is required');
    }

    const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

    // Construct request
    const request = {
      parent
    };

    // Run request
    const data = [];
    const iterable = meetClient.listParticipantSessionsAsync(request);
    for await (const response of iterable) {
      data.push(response);;
    }

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};

const getGoogleParticipantSession = async (userId, name) => {
  try {
    // Fetch the user from the database
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!name) {
      throw new Error('name not found');
    }

   const oauth2Client = await getOAuth2Client(user)

    // Instantiates a client
    const meetClient = new ConferenceRecordsServiceClient({
      authClient: oauth2Client
    });

  // Construct request
    const request = {
      name
    };

    // Run request
    const data = await meetClient.getParticipantSession(request);

    return {data}
    

  } catch (error) {
    console.error('Error creating Google Meet event:', error);
    throw error;
  }
};


module.exports = {
  activeMeetings,
  transcribeAudio,
  joinGoogleMeeting,
  createGoogleMeetEvent,
  getGoogleMeetSchedule,
  convertToWav,
  transcribeAudio,
  generateGoogleSpace,
  getGoogleSpace,
  getGoogleConferenceList,
  getGoogleSingleConference,
  getGoogleRecordList,
  getGoogleRecord,
  getGoogleParticipantList,
  getGoogleParticipant,
  getGoogleTranscriptList,
  getGoogleTranscript,
  getGoogleParticipantSessionList,
  getGoogleParticipantSession,
};

// // Joint meeting 
// const joinGoogleMeeting = async (meetLink, email, password, userId) => {
//   const meetingTimeOut = 1000 * 60 * parseInt(MEETING_DURATION)
//   const isLinux = os.platform() === "linux";
//   let browser;
//   let stream;
//   const outputDir = path.join(__dirname, '..', '..', 'uploads', `${userId}`);
//   const videoOutputFile = path.join(outputDir, `${uuidv4()}.webm`);

//   await fs.promises.mkdir(outputDir, { recursive: true });
//   const file = fs.createWriteStream(videoOutputFile);

//   try {
//     browser = await launch(puppeteer, {
//       headless: 'new',
//       executablePath: isLinux ? CHROME_PATH : 'C:/Program Files/Google/Chrome/Application/chrome.exe',
//       args: [
//         '--use-fake-device-for-media-stream',
//         '--ignore-certificate-errors',
//         '--enable-features=ChromeBrowserCloudManagement',
//         '--disable-notifications',
//         '--disable-dev-shm-usage',
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--autoplay-policy=no-user-gesture-required',
//       ],
//       ignoreDefaultArgs: ['--mute-audio'],
//     });

//     const page = await browser.newPage();
//     await page.setViewport({width: 1080, height: 720});

//     const context = browser.defaultBrowserContext();
//     await context.overridePermissions(meetLink, ['camera', 'microphone']);

//     await loginToGoogle(page, email, password);
//     await joinMeeting(page, meetLink);

//     let isVideo = false;
//     try {
//       const data = await MeetingSettingsModel.findOne({ user : userId });
//       isVideo = data?.recordVideo || false;
//     }catch (error) {
//       console.log('No video element found');
//     }

//     console.log("Joined the meeting in background");

//     stream = await getStream(page, { audio: true, video: isVideo });

//     console.log("Video recording", isVideo);

//     stream.pipe(file);
  
//     const getParticipantNames = async () => {
//       return await page.evaluate(() => {
//         const nameElements = document.querySelectorAll('.zWGUib');
//         return Array.from(nameElements).map(element => element.textContent.trim());
//       });
//     };

//     // Function to check participant count
//     const checkParticipantCount = async () => {
//       const participantCount = await page.evaluate(() => {
//         const element = document.querySelector('.gFyGKf.BN1Lfc .uGOf1d');
//         return element ? parseInt(element.textContent, 10) : 0;
//       });
//       return participantCount;
//     };

//     let lowParticipantStartTime = null;
//     let isMeetingClosed = false;
//     let participants;

//     // Function to close the meeting and initiate transcription
//     const closeMeetingAndTranscribe = async (reason) => {
//       if (isMeetingClosed) return;
//       isMeetingClosed = true;

//       console.log(`Closing meeting due to: ${reason}`);
//       clearInterval(checkAndCloseInterval);
//       clearTimeout(timeoutTimer);
      
//       stream.destroy();
//       await page.close();
//       await browser.close();
//       file.close();
//       console.log("Meeting closed and recording stopped.");

//       // Initiate transcription and processing
//       await processRecording(videoOutputFile, userId, meetLink, participants);
//     };

//     const checkAndCloseInterval = setInterval(async () => {
//       const count = await checkParticipantCount();
//       console.log(`Current participant count: ${count}`);

//       try {
//         participants = await getParticipantNames();
//         console.log(`Participants:`, participants);
//       } catch (error) {
//         console.error('Error getting participant names:', error);
//       }

//       if (count < 2) {
//         if (!lowParticipantStartTime) {
//           lowParticipantStartTime = Date.now();
//         } else if (Date.now() - lowParticipantStartTime >= 2 * 60 * 1000) {
//           await closeMeetingAndTranscribe("Less than 2 participants for 2 minutes");
//         }
//       } else {
//         lowParticipantStartTime = null;
//       }
//     }, 10000);

//     // Set a timeout to stop the meeting after the specified duration
//     const timeoutTimer = setTimeout(async () => {
//       await closeMeetingAndTranscribe("Meeting duration reached");
//     }, meetingTimeOut);

//   } catch (error) {
//     console.error("Error in joinGoogleMeeting:", error.message);

//   }
// };


// // Transcribe audio with azure ConversationTranscriber
// const transcribeAudio = async (audioFilePath, userId) => {
//   console.log('Start Transcribing...........')
//   const subscriptionKey = AZURE_SUBSCRIPTION_KEY;
//   const serviceRegion = AZURE_SPEECH_REGION;

//   if (!subscriptionKey || !serviceRegion) {
//     console.error('Azure subscription key or region not set. Please check your environment variables.');
//     return;
//   }

//   let language = 'en-US';
//   try {
//     const data = await MeetingSettingsModel.findOne({ user: userId });
//     if (data && data.meetingLanguage) {
//       const languageSetting = data.meetingLanguage.toLowerCase();
//       switch (languageSetting) {
//         case 'bengali':
//           language = 'bn-In';
//           break;
//         case 'bangla':
//           language = 'bn-In';
//           break;
//         case 'english':
//           language = 'en-US';
//           break;
//         default:
//           language = 'en-US';
//           break;
//       }
//     }
//   } catch (error) {
//     console.error('Error in getting language:', error.message);
//   }

//   const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
//   speechConfig.speechRecognitionLanguage = language

//   let audioConfig;
//   if (audioFilePath.endsWith('.wav')) {
//     audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(audioFilePath));
//   } else {
//     const pushStream = sdk.AudioInputStream.createPushStream();
//     fs.createReadStream(audioFilePath).on('data', arrayBuffer => {
//       pushStream.write(arrayBuffer.slice());
//     }).on('end', () => {
//       pushStream.close();
//     });
//     audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
//   }

//   let conversationTranscriber = new sdk.ConversationTranscriber(speechConfig, audioConfig);

//   return new Promise((resolve, reject) => {
//     let conversations = [];
//     let text = '';

//     conversationTranscriber.transcribing = (s, e) => {
//       console.log(`TRANSCRIBING: Text=${e.result.text}`);
//     };

//     conversationTranscriber.transcribed = (s, e) => {
//       if (e.result.reason == sdk.ResultReason.RecognizedSpeech) {
//         console.log(`TRANSCRIBED: Text=${e.result.text}`);

//         text += ` ${e.result.text}`;

//         conversations.push({
//           name: e.result.speakerId,
//           text: e.result.text,
//           time: `${formatDuration(e.result.offset)} - ${formatDuration(e.result.offset + e.result.duration)}`
//         });
//       }
//       else if (e.result.reason == sdk.ResultReason.NoMatch) {
//         console.log("NOMATCH: Speech could not be transcribed.");
//       }
//     };

//     conversationTranscriber.canceled = (s, e) => {
//       console.log(`CANCELED: Reason=${e.reason}`);
//       if (e.reason == sdk.CancellationReason.Error) {
//         console.log(`CANCELED: ErrorCode=${e.errorCode}`);
//         console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
//         console.log("CANCELED: Did you set the speech resource key and region values?");
//       }
//       conversationTranscriber.stopTranscribingAsync();
//     };

//     conversationTranscriber.sessionStopped = (s, e) => {
//       console.log("\nSession stopped event.");
//       conversationTranscriber.stopTranscribingAsync();
//     };

//     conversationTranscriber.startTranscribingAsync(() => {
//       console.log('Transcription started');
//     });

//     // Stop transcription after 30 seconds or adjust as needed
//     setTimeout(() => {
//       conversationTranscriber.stopTranscribingAsync(
//         () => {
//           console.log('Transcription stopped');
//           resolve({ text, conversations });
//         },
//         (err) => {
//           console.error(err);
//           reject(err);
//         }
//       );
//     }, 1000 * 30);
//   });
// }
