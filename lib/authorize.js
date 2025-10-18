const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { EVENT_EMAIL } = require('../config/constant');
const CREDENTIALS_PATH = path.join(__dirname, "..", "cred", "service_account.json");

async function authorize() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const { client_email, private_key } = credentials;
    
    console.log('Credentials loaded:', { client_email });

    const oAuth2Client = new google.auth.JWT(
        client_email,
        null,
        private_key,
        [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/meetings.minute',
            'https://www.googleapis.com/auth/meetings.space.created',
            'https://www.googleapis.com/auth/meetings.space.readonly'
        ],
        EVENT_EMAIL
    );

    try {
        const token = await oAuth2Client.authorize();
        console.log('Authorization successful:', token);
        return oAuth2Client;
    } catch (error) {
        console.error('Authorization failed:', error);
        throw error;
    }
}

module.exports = { authorize };
