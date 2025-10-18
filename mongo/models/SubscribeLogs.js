const mongoose = require('mongoose');

const subscribeLogsSchema = new mongoose.Schema({
  user:{
    type: mongoose.Types.ObjectId,
    ref: 'User'
  },
  transection: {
    type: mongoose.Types.ObjectId,
    ref: 'transections'
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'failed',
  },
  message: {
    type: String,
    default: '',
  },
  payload: {
    type:  mongoose.Schema.Types.Mixed,
  },
},
{
    timestamps:true
}
);

const SubscribeLogs = mongoose.model('SubscribeLogs', subscribeLogsSchema);

// Async function to save error logs
async function saveSubscribeLogs({user, transection, status, message, payload}) {
  
  if (typeof message !== 'string' || message.trim() === '') {
    console.error('Invalid error message provided.');
    return;
  }

  try {
    const SubscribeLog = new SubscribeLogs({
     user, transection, status, message, payload
    });
    await SubscribeLog.save();
    console.log('Subscribe log saved successfully: ', SubscribeLog);
  } catch (error) {
    console.error('Subscribe occurred while saving error log:', error.message);
  }
}

module.exports = {
  SubscribeLogs,
  saveSubscribeLogs,
};
