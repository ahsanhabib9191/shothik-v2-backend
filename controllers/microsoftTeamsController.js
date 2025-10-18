const axios = require('axios');
const { getAuthToken } = require('../utils/auth');
const { getMsAuthToken } = require('@ridz-shothikai/shothik-auth-service/src/models/User');

module.exports.scheduleMircosoftMeet = async (req, res)  => {
     const eventData = {
        subject: req.body.subject,
        startDateTime: req.body.startDateTime,
        endDateTime: req.body.endDateTime,
        attendees: req.body.attendees.map(email => ({
            emailAddress: { address: email },
            type: 'required'
        })),s
    };
    createTeamsMeeting(eventData);
    res.status(200).send('Microsoft Teams meeting scheduled successfully');

}

async function createTeamsMeeting(eventData) {
    const token = await getMsAuthToken();
    try {
        const response = await axios.post('https://graph.microsoft.com/v1.0/me/onlineMeetings', eventData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        console.log('Meeting created: %s', response.data.joinUrl);
    } catch (error) {
        console.error('Error creating meeting', error);
    }
}
