const axios = require('axios');

// Helper function to create speaker profiles
async function createSpeakerProfiles(speakers) {
  const profiles = [];
  
  for (const speaker of speakers) {
    try {
      const response = await axios.post(
        `${SPEAKER_RECOGNITION_ENDPOINT}/speaker-recognition/v1.0/text-independent/profiles`,
        {},
        {
          headers: {
            'Ocp-Apim-Subscription-Key': SPEAKER_RECOGNITION_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      profiles.push({
        name: speaker,
        profileId: response.data.identificationProfileId
      });

      console.log(`Created profile for ${speaker}: ${response.data.identificationProfileId}`);
    } catch (error) {
      console.error(`Error creating profile for ${speaker}:`, error.message);
    }
  }

  return profiles;
}

// Helper function to identify the speaker
async function identifySpeaker(audioChunk, speakerProfiles) {
  try {
    // Convert audioChunk to the required format (assuming it's a Buffer)
    const audioBuffer = Buffer.from(audioChunk);

    // Create a form data object to send the audio
    const formData = new FormData();
    formData.append('audio', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });

    // Get all profile IDs
    const profileIds = speakerProfiles.map(profile => profile.profileId).join(',');

    const response = await axios.post(
      `${SPEAKER_RECOGNITION_ENDPOINT}/speaker-recognition/v1.0/text-independent/profiles/identifications?identificationProfileIds=${profileIds}`,
      formData,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': SPEAKER_RECOGNITION_KEY,
          ...formData.getHeaders()
        }
      }
    );

    const identifiedProfileId = response.data.identifiedProfileId;
    const identifiedSpeaker = speakerProfiles.find(profile => profile.profileId === identifiedProfileId);

    return identifiedSpeaker ? identifiedSpeaker.name : 'Unknown Speaker';
  } catch (error) {
    console.error('Error identifying speaker:', error.message);
    return 'Unknown Speaker';
  }
}

// Helper function to format duration
function formatDuration(durationInTicks) {
  // Azure returns duration in 100-nanosecond ticks
  const totalMilliseconds = durationInTicks / 10000;
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = Math.floor(totalMilliseconds % 1000);

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZeroMilliseconds(milliseconds)}`;
}

// Helper function to pad zeros for formatting
function padZero(num) {
  return num.toString().padStart(2, '0');
}

// Helper function to pad zeros for milliseconds
function padZeroMilliseconds(num) {
  return num.toString().padStart(3, '0');
}

module.exports = {
  createSpeakerProfiles,
  identifySpeaker,
  formatDuration
};