const path = require('path');
const fs = require('fs')
const { v4: uuidv4 } = require("uuid");
const { default: mongoose } = require('mongoose');
const { joinGoogleMeeting, createGoogleMeetEvent, getGoogleMeetSchedule, generateGoogleSpace, getGoogleRecord, getGoogleConferenceList, getGoogleSingleConference, getGoogleRecordList, getGoogleSpace, getGoogleParticipantList, getGoogleParticipant, getGoogleTranscriptList, getGoogleTranscript, getGoogleParticipantSessionList, getGoogleParticipantSession, activeMeetings } = require('../lib/google/googleMeeting');
const { BOT_EMAIL, BOT_PASSWORD } = require('../config/constant');
const { ScheduleEvent } = require("../mongo/models/ScheduleEvent");
const ApiFeatures = require('../lib/ApiFeatures');
const { User } = require('@ridz-shothikai/shothik-auth-service/src/models/User');
const { MeetingModel } = require("../mongo/models/meetingMinute");
const { transcribeTableMeeting } = require("../lib/transcribeTableMeeting");

// Create google meet link
module.exports.createGoogleMeetLink = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { title, platform, attendees }= req.body
    
    let eventData = {
        summary: "Google Meet Conference",
        start: {dateTime: new Date().toISOString(), timeZone: "UTC"},
        end: {
            dateTime: new Date(Date.now() + 3600000).toISOString(),
            timeZone: "UTC",
        },
        attendees: req.body.attendees.map(email => ({ email })),
        conferenceData: {
            createRequest: {
                requestId: uuidv4().substring(0, 5),
                conferenceSolutionKey: {
                    type: 'hangoutsMeet',
                },
            },
        },
    };

    try {

        const event = await createGoogleMeetEvent(eventData, userId)
        
        const meetingMinute = await MeetingModel.create({
            title: title,
            author: userId,
            platform: platform,
            participants: attendees.toString()
        })

        const updateScheduleData = {
            user: userId,
            ...event.data,
            meeting: meetingMinute._id
        }

        const responseData = await ScheduleEvent.create(updateScheduleData)

        await MeetingModel.findByIdAndUpdate(meetingMinute._id, {
            eventData: responseData._id
        })

        res.status(200).json({ success: true, message: 'Google Meet create successfully', data: responseData.hangoutLink });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to schedule Google Meet', error: error.message });
    }
};

// Join google meet link
module.exports.JoinMeet = async (req, res) => {
    const userId = req.id;
    const { link } = req.query;
    const email = BOT_EMAIL
    const password = BOT_PASSWORD
    if (!link) {
        return res.status(400).json({success: false, message: 'Meeting link are required'});
    }

    try {
        // Join the meeting in the background
        if(link.includes('google')){
            joinGoogleMeeting(link, email, password, userId);
            res.status(200).json({success:true, message: 'Joining google meeting in the background'});
        }
    } catch (error) {
        console.error('Error initiating meeting join:', error);
       return res.status(500).send('Failed to initiate meeting join');
    }
};

module.exports.CloseMeet = async(req, res)=>{
    const userId = req.id;
    try {
        const stopMeetingFunction = activeMeetings.get(userId);

        if (stopMeetingFunction) {
            stopMeetingFunction();
            res.status(200).json({ message: `Meeting stopped for user ${userId}` });
        } else {
            res.status(404).json({ message: `No active meeting found for user ${userId}` });
        }
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({message: error.message});
    }
}

// Schedule google meet link
module.exports.scheduleGoogleMeet = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { title, platform, attendees }= req.body
    
    let eventData = {
        summary: req.body.summary,
        description: req.body.description,
        start: {
            dateTime: req.body.startDateTime,
            timeZone: req.body.timeZone,
        },
        end: {
            dateTime: req.body.endDateTime,
            timeZone: req.body.timeZone,
        },
        attendees: req.body.attendees.map(email => ({ email })),
        conferenceData: {
            createRequest: {
                requestId: uuidv4().substring(0, 5),
                conferenceSolutionKey: {
                    type: 'hangoutsMeet',
                },
            },
        },
    };

    try {

        const event = await createGoogleMeetEvent(eventData, userId)
        
        const meetingMinute = await MeetingModel.create({
            title: title,
            author: userId,
            platform: platform,
            participants: attendees.toString()
        })

        const updateScheduleData = {
            user: userId,
            ...event.data,
            meeting: meetingMinute._id
        }

        const responseData = await ScheduleEvent.create(updateScheduleData)

        await MeetingModel.findByIdAndUpdate(meetingMinute._id, {
            eventData: responseData._id
        })

        res.status(200).json({ success: true, message: 'Google Meet scheduled successfully', data: responseData });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to schedule Google Meet', error: error.message });
    }
}

// Schedule google meet link
module.exports.getMySchedule = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
     try {
        const { keyword } = req.query;
        let perPage;

        if (req.query && typeof req.query.limit === 'string') {
            perPage = parseInt(req.query.limit, 10);
        }

        // Construct the search criteria
        const searchCriteria = { user: userId, isCompleted: false};
        if (keyword) {
            searchCriteria.summary = keyword;
        }
       
        const count = await ScheduleEvent.countDocuments(searchCriteria);

        const apiFeature = new ApiFeatures(
            ScheduleEvent.find(searchCriteria)
            .select('summary description isJoin isCompleted hangoutLink')
            .populate({
                path: 'meeting',
                select: '-transcribeData',
            })
            .populate({
                path: 'user',
                select: 'name email image',
            })
            .sort({ createdAt: -1 }),
            req.query,
        )
        .search()
        .filter();

        if (perPage !== undefined) {
            apiFeature.pagination(perPage);
        }

        const result = await apiFeature.query;
        const limit = result.length;

        const currentPage = req.query.page
            ? parseInt(req.query.page, 10)
            : 1;

        let totalPages;

        if (perPage !== undefined) {
            totalPages = Math.ceil(count / perPage);
        }

        let nextPage;
        let nextUrl;

        if (perPage !== undefined && currentPage < totalPages) {
            nextPage = currentPage + 1;
            nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
            if (keyword) {
                nextUrl += `&keyword=${keyword}`;
            }
        }

        res.status(200).json({
            success: true,
            data: result || [],
            total: count,
            perPage,
            limit,
            nextPage,
            nextUrl,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
    
}

// Schedule my complete meet link
module.exports.getMyCompletedMeeting = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
     try {
        const { keyword } = req.query;
        let perPage;

        if (req.query && typeof req.query.limit === 'string') {
            perPage = parseInt(req.query.limit, 10);
        }

        // Construct the search criteria
        const searchCriteria = { user: userId, isCompleted: true};
        if (keyword) {
            searchCriteria.summary = keyword;
        }
       
        const count = await ScheduleEvent.countDocuments(searchCriteria);

        const apiFeature = new ApiFeatures(
            ScheduleEvent.find(searchCriteria)
            .select('summary description isJoin isCompleted hangoutLink')
            .populate({
                path: 'meeting',
                select: '-transcribeData',
            })
            .populate({
                path: 'user',
                select: 'name email image',
            })
            .sort({ createdAt: -1 }),
            req.query,
        )
        .search()
        .filter();

        if (perPage !== undefined) {
            apiFeature.pagination(perPage);
        }

        const result = await apiFeature.query;
        const limit = result.length;

        const currentPage = req.query.page
            ? parseInt(req.query.page, 10)
            : 1;

        let totalPages;

        if (perPage !== undefined) {
            totalPages = Math.ceil(count / perPage);
        }

        let nextPage;
        let nextUrl;

        if (perPage !== undefined && currentPage < totalPages) {
            nextPage = currentPage + 1;
            nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
            if (keyword) {
                nextUrl += `&keyword=${keyword}`;
            }
        }

        res.status(200).json({
            success: true,
            data: result || [],
            total: count,
            perPage,
            limit,
            nextPage,
            nextUrl,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
    
}

// Change schedule status
module.exports.changeScheduleStatus = async(req, res)=>{
    const userId = new mongoose.Types.ObjectId(req.id)
    const scheduleId = new mongoose.Types.ObjectId(req.params.id);
    const {isJoin} = req.body;
   try {
         const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({success: false, message: "User not found"})
        }
        const schedule = await ScheduleEvent.findOne({_id: scheduleId, user: userId});
        if(!schedule){
            return res.status(404).json({success: false, message: "Schedule not found"})
        }
        schedule.isJoin = isJoin
        
        const data = await schedule.save();
        res.status(200).json({success: true, message: "Update success", data})
   } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: error.message})
   }
}

// Delete schedule
module.exports.deleteSchedule = async(req, res)=>{
    const userId = new mongoose.Types.ObjectId(req.id)
    const scheduleId = new mongoose.Types.ObjectId(req.params.id);
   try {
        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({success: false, message: "User not found"})
        }

        // Find the schedule by ID
        const schedule = await ScheduleEvent.findById(scheduleId);
        if (!schedule) {
            return res.status(404).json({ success: false, message: "Schedule not found" });
        }

        // If the schedule has a related meeting, delete the meeting
        if (schedule.meeting) {
            await MeetingModel.findByIdAndDelete(schedule.meeting);
        }

        // Delete the schedule
        await ScheduleEvent.findByIdAndDelete(scheduleId);

        res.status(200).json({ success: true, message: "Schedule and related meeting deleted successfully" });
        }catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: error.message})
   }
}

// Get My Google schedule
module.exports.getMyGoogleCalendarSchedule = async(req, res)=>{
    const userId = new mongoose.Types.ObjectId(req.id)
   try {
    
      const data = await getGoogleMeetSchedule(userId)

        res.status(200).json({ success: true, message: "Schedule get successfully", data });
        }catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: error.message})
   }
}

// Transcribe table meeting
module.exports.tableMeetingTranscribe = async (req, res) => {
    try {
        if (!req.files || !req.files.audio) {
            return res.status(400).json({
                success: false,
                message: "No audio file uploaded"
            });
        }

        const audioFile = req.files.audio;
        const uploadPath = path.join(__dirname, '..', 'uploads', audioFile.name);

        await audioFile.mv(uploadPath);

        try {
            const transcription = await transcribeTableMeeting(uploadPath);

            fs.unlinkSync(uploadPath);

            res.status(200).json({
                success: true,
                data: transcription
            });
        } catch (transcriptionError) {
            console.error("Transcription error:", transcriptionError);
            fs.unlinkSync(uploadPath);
            res.status(500).json({
                success: false,
                message: "Error during transcription: " + transcriptionError.message
            });
        }
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({
            success: false,
            message: "An unexpected error occurred: " + error.message
        });
    }
};

// Create google space with meet link
module.exports.createGoogleSpace = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    try {

        const {data} = await generateGoogleSpace(userId)

        res.status(200).json({ success: true, message: 'Google space create successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to create space', error: error.message });
    }
};

// Get single space
module.exports.getSingleSpace = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleSpace(userId, name)

        res.status(200).json({ success: true, message: 'Get space successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to schedule Google Meet', error: error.message });
    }
};

// Get google conference list
module.exports.getGoogleMeetingConferenceList = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleConferenceList(userId, name)

        res.status(200).json({ success: true, message: 'Get conference list successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to conference list', error: error.message });
    }
};

// get single conference
module.exports.getGoogleMeetingConference = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleSingleConference(userId, name)

        res.status(200).json({ success: true, message: 'Get conference successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get conference', error: error.message });
    }
};

// Get google meeting record list
module.exports.getGoogleMeetingRecordList = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { parent } = req.body;
    try {

        const { data } = await getGoogleRecordList(userId, parent)

        res.status(200).json({ success: true, message: 'Get record list successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get record list', error: error.message });
    }
};

// Get google single meeting record
module.exports.getGoogleMeetingRecord = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleRecord(userId, name)

        res.status(200).json({ success: true, message: 'Get record successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get single record', error: error.message });
    }
};

// Get google participant list
module.exports.getGoogleMeetingParticipantList = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { parent } = req.body;
    try {

        const { data } = await getGoogleParticipantList(userId, parent)

        res.status(200).json({ success: true, message: 'Get record list successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get record list', error: error.message });
    }
};

// Get google single participant
module.exports.getGoogleMeetingParticipant = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleParticipant(userId, name)

        res.status(200).json({ success: true, message: 'Get record successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get single record', error: error.message });
    }
};

// Get google transcription list
module.exports.getGoogleMeetingTranscriptionList = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { parent } = req.body;
    try {

        const { data } = await getGoogleTranscriptList(userId, parent)

        res.status(200).json({ success: true, message: 'Get transcription list successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get record list', error: error.message });
    }
};

// Get google single Transcription
module.exports.getGoogleMeetingTranscription = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleTranscript(userId, name)

        res.status(200).json({ success: true, message: 'Get transcription successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get single record', error: error.message });
    }
};

// Get google participant list
module.exports.getGoogleMeetingParticipantSessionList = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { parent } = req.body;
    try {

        const { data } = await getGoogleParticipantSessionList(userId, parent)

        res.status(200).json({ success: true, message: 'Get participant session list successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get record list', error: error.message });
    }
};

// Get google single participant
module.exports.getGoogleMeetingParticipantSession = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.id);
    const { name } = req.body;
    try {

        const { data } = await getGoogleParticipantSession(userId, name)

        res.status(200).json({ success: true, message: 'Get participant session successfully', data: data });
    } catch (error) {
       return res.status(500).json({ success: false, message: 'Failed to get single record', error: error.message });
    }
};



