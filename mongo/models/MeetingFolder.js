const mongoose = require('mongoose');

const meetingFolderSchema = new mongoose.Schema({
    folder: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Folder', 
        required: true 
    },
    meeting: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Meeting', 
        required: true 
    },
},
{
    timestamps: true,
}
);


const MeetingFolder = mongoose.model('MeetingFolder', meetingFolderSchema);
module.exports = { MeetingFolder };