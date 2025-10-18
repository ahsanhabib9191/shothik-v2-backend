const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['paraphrase', 'bypass', 'bangla_grammer', 'english_grammer', 'summarize', 'copywrite', 'translator', 'meeting_minutes'],
  },
  input: {
    type: mongoose.Schema.Types.Mixed,
  },
  output: {
    type: mongoose.Schema.Types.Mixed,
  },
},
  {
    timestamps: true
  }
)

module.exports = mongoose.model('Report', reportSchema)