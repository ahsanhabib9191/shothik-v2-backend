const { Schema, model } = require("mongoose");

const transcriptionSchema = new Schema({
    text: {
        type: String,
        required: false
    },
    summary: {
        type: String,
    },
    conversations: [{
        name: {
            type: String,
            required: true
        },
        text: {
            type: String,
            default: ''
        },
        time: {
            type: String,
        }
    }],
    status: {
        type: String,
        enum: ['pending', 'complete', 'failed'],
        default: 'pending'
    },
    meeting:{
        type: Schema.Types.ObjectId,
        ref: 'Meeting'
    }
},
{
    timestamps: true,
}
);

const TranscriptionModel = model("Transcribtion", transcriptionSchema);

module.exports = {
    TranscriptionModel
};
