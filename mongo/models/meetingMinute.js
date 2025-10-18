const { Schema, model, Types } = require("mongoose");

const meetingSchema = new Schema({
        author: {
            type: Types.ObjectId,
            ref: 'User'
        },
        title: {
            type: String,
        },
        type: {
            type: String,
            enum: ['online', 'offline', 'audio', 'video'],
            default: 'offline'
        },
        media: {
            type: String,
            required: false
        },
        media_video: {
            type: String,
            required: false
        },
        duration: { 
            type: Number, 
            required: false 
        },
        transcribeData: {
            type: Schema.Types.Mixed,
            default: '' 
        },
        participants: {
            type: Schema.Types.Mixed,
            default: ''
        },
        notes: { 
            type: String, 
            default: '' 
        },
        keyNotes: {
            type: String,
            default: ''
        },
        visibility: {
            type: Boolean,
            default: false,
            
        },
        status: {
            type: String,
            enum: ['queued', 'processing', 'completed', 'failed'],
            default: 'queued'
        },
        recordingStatus: {
            type: String,
            enum: ['started', 'stopped', 'completed'],
            default: 'stopped'
        },
        transcription: {
            type: Schema.Types.ObjectId,
            ref: 'Transcribtion'
        },
        botIntegration: {
            type: Boolean,
            default: false
        },
        isVideoRecord: {
            type: Boolean,
            default: false
        },
        language:{
            type: String,
        },
        eventData: {
            type: Schema.Types.ObjectId,
            ref: 'ScheduledEvent'
        },
        platform: {
            type: String,
            enum: ['google-meet', 'microsoft-team', 'uploaded-meeting'],
            default: 'uploaded-meeting'
        },
        errorMessage: {
            type: String,
            default: null
        },
    },
    {
        timestamps:true
    }
);
  
const MeetingModel = model('Meeting', meetingSchema);

module.exports =  { MeetingModel }


