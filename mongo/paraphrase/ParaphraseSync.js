const mongoose = require('mongoose');

const ParaphraseSentanceSync = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sentance: { 
        type: String, 
        required: true ,
        unique: true
    },
},
{
    timestamps: true,
}
);


// model 
const synonymPhraseSchema = new mongoose.Schema({
    s_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'paraphrases-sentances',
        required: true
    },
    term: {
      type: String,
      required: true,
      index: true // Index for faster searching
    },
    synonymList: [{
      type: String
    }],
    type: {
      type: String,
      enum: ['synonym', 'phrase'], // Restrict type to 'synonym' or 'phrase'
      required: true
    },

});

const SynonymPhrase = mongoose.model('synonyms-phrase', synonymPhraseSchema);

const ParaphraseSyncSentance = mongoose.model('paraphrases-sentances', ParaphraseSentanceSync);
module.exports = { ParaphraseSyncSentance, SynonymPhrase };
