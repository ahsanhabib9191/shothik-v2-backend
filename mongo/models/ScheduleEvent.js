const { Schema, model, default: mongoose } = require('mongoose');

const eventSchema = new Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
    },
    meeting: {
        type: mongoose.Types.ObjectId,
        ref: 'Meeting',
    },
    googleEventId: {
        type: String,
    },
    kind: {
        type: String,
        default: 'calendar#event'
    },
    etag: String,
    status: {
        type: String,
        default: 'confirmed'
    },
    htmlLink: String,
    created: {
        type: Date,
        default: Date.now
    },
    updated: Date,
    summary: {
        type: String,
    },
    description: String,
    creator: {
        email: String,
        self: Boolean
    },
    organizer: {
        email: String,
        self: Boolean
    },
    start: {
        dateTime: {
            type: Date,
        },
        timeZone: {
            type: String,
        }
    },
    end: {
        dateTime: {
            type: Date,
        },
        timeZone: {
            type: String,
        }
    },
    iCalUID: String,
    sequence: {
        type: Number,
        default: 0
    },
    hangoutLink: String,
    conferenceData: {
       type: Schema.Types.Mixed,
    },
    reminders: {
        useDefault: {
            type: Boolean,
            default: true
        }
    },
    eventType: {
        type: String,
        default: 'default'
    },
    attendees: [{
        email: {
            type: String,
            required: true
        }
    }],
    platform: {
        type: String,
        enum: ['google-meet', 'microsoft-team'],
        defualt: 'google-meet'
    },
    isJoin: {
        type: Boolean,
        default: true,
    },
    isCompleted: {
        type: Boolean,
        default: false,
    }
},
{
    timestamps: true
});

const ScheduleEvent = model('ScheduleEvent', eventSchema);

module.exports = { ScheduleEvent };
