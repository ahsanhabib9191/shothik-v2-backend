const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
    ip: String,
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
    },
    browser_agent:{
        type: String,
    },
    session_id:{
        type: String,
    },
    timestamp: { type: Date, default: Date.now },
    services: {
        paraphrase: { type: Number, default: 0 },
        en_grammar: { type: Number, default: 0 },
        bn_grammar: { type: Number, default: 0 },
        summarizer: { type: Number, default: 0 },
        copy_writer: { type: Number, default: 0 },
        translator: { type: Number, default: 0 }
    },

    upgrade_required: { type: Boolean, default: false },
});


const UsageModel = mongoose.model('usages', usageSchema);
module.exports = { UsageModel };