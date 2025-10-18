const express = require('express');
const asyncHandler = require('express-async-handler');
const { auth } = require('@ridz-shothikai/shothik-auth-service/src/middleware');
const { scheduleGoogleMeet, JoinMeet, createGoogleMeetLink, getMySchedule, changeScheduleStatus, getMyCompletedMeeting, deleteSchedule, getMyGoogleCalendarSchedule, tableMeetingTranscribe, createGoogleSpace, getGoogleMeetingRecord, getGoogleMeetingConferenceList, getGoogleMeetingConference, getGoogleMeetingRecordList, getSingleSpace, getGoogleMeetingParticipantList, getGoogleMeetingParticipant, getGoogleMeetingTranscriptionList, getGoogleMeetingTranscription, getGoogleMeetingParticipantSessionList, getGoogleMeetingParticipantSession, CloseMeet } = require('../controllers/googleMeetController');
const router = express.Router();

// Meeting route here
router.post('/join-meet', auth, asyncHandler(JoinMeet));
router.post('/close-meet', auth, asyncHandler(CloseMeet));


// Create google schedule with calender
router.post('/google/meet-schedule', auth, asyncHandler(scheduleGoogleMeet));
router.post('/google/create-meet', auth, asyncHandler(createGoogleMeetLink));
router.get('/schedules', auth, asyncHandler(getMyGoogleCalendarSchedule));

// ======Google meet api====
router.post('/google/create-space', auth, asyncHandler(createGoogleSpace));
router.get('/google/space', auth, asyncHandler(getSingleSpace));
router.get('/google/conference-list', auth, asyncHandler(getGoogleMeetingConferenceList));
router.get('/google/conference', auth, asyncHandler(getGoogleMeetingConference));
router.get('/google/record-list', auth, asyncHandler(getGoogleMeetingRecordList));
router.get('/google/record', auth, asyncHandler(getGoogleMeetingRecord));
router.get('/google/participant-list', auth, asyncHandler(getGoogleMeetingParticipantList));
router.get('/google/participant', auth, asyncHandler(getGoogleMeetingParticipant));
router.get('/google/participant-session-list', auth, asyncHandler(getGoogleMeetingParticipantSessionList));
router.get('/google/participant-session', auth, asyncHandler(getGoogleMeetingParticipantSession));
router.get('/google/transcription-list', auth, asyncHandler(getGoogleMeetingTranscriptionList));
router.get('/google/transcription', auth, asyncHandler(getGoogleMeetingTranscription));

// Schedule meeting-minute
router.get('/schedule/all', auth, asyncHandler(getMySchedule));
router.get('/completed/all', auth, asyncHandler(getMyCompletedMeeting));
router.put('/schedule/change-status/:id', auth, asyncHandler(changeScheduleStatus));
router.delete('/schedule/delete/:id', auth, asyncHandler(deleteSchedule));


router.post('/table-meeting-transcribe', asyncHandler(tableMeetingTranscribe));

// Export the router
module.exports = router;
