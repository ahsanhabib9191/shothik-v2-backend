const mongoose = require("mongoose");

const geminiAPIkeysSchema = new mongoose.Schema({
  apiKey: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  keyIndex: {
    type: Number,
    required: true,
    default: 0,
  },
  lastUsed: {
    type: Date,
    default: Date.now,
  },
  totalUsed: {
    type: Number,
    default: 0,
  },
  // Last Error 
  lastError: {
    type: String,
    default: "",
  },
  is_premium: {
    type: Boolean,
    default: false,
  },
  is_disabled:{
    type: Boolean,
    default: false
  }
});


// API key Models and Schemas for gemini model , RPM and LIMIT
const geminiModelSchema = new mongoose.Schema({
  apiKeyId: {
    type: mongoose.Types.ObjectId,
    ref: "GeminiAPIkeys",
    required: true,
  },
  name:{
    type: String,
    required: true
  },
  rpm:{
    type: Number,
    required: true
  },
  total_limit:{
    type: Number,
    required: true
  }
});

// daily useage tracker
const dailyUsageSchema = new mongoose.Schema({
  apiKeyId: {
    type: mongoose.Types.ObjectId,
    ref: "GeminiAPIkeys",
    required: true,
  },
  total_used: {
    type: Number,
    required: true,
  },
  date: {
    type: String,
    default: () => new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/ /g, '-'),
  },
});



const GeminiAPIkeys = mongoose.model("GeminiAPIkeys", geminiAPIkeysSchema);
const GeminiModel = mongoose.model("GeminiModels", geminiModelSchema);
const DailyUsage = mongoose.model("DailyUsage", dailyUsageSchema);

module.exports = { GeminiAPIkeys, GeminiModel, DailyUsage };
