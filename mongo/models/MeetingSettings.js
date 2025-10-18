const { Schema, model, default: mongoose } = require("mongoose");

const meetingSettingsSchema = new Schema({
        user: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true 
        },
        emailSettings: {
            type: String, 
            enum: ['only_me', 'every_one'],
            default: 'only_me' 
        },
        meetingLanguage: { 
            type: String, 
            enum: ['english', 'bengali'],
            default: 'english' 
        },
        autoJoinSettings: {
            type: String, 
            enum: ['yes', 'no'],
            default: 'yes' 
        },
        privacySettings: {
            type: String, 
            enum: ['any_one', 'only_me', 'only_participants'],
            default: 'only_me'
        },
        recordVideo: { 
            type: Boolean, 
            default: false 
        },
        calendarMeetings: {
            connected: { 
                type: Boolean, 
                default: false 
            },
            sync: { 
                type: Boolean, 
                default: false 
            }
        },
    },
    {
        timestamps:true
    }
);
  
const MeetingSettingsModel = model('MeetingSettings', meetingSettingsSchema);

module.exports =  { MeetingSettingsModel }


