const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    isRegistered: {
      type: Boolean,
      default: false,
    },
    ipAddress: {
      type: String,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    browser_agent: {
      type: String,
    },
    package: {
      type: String,
    },
    session_id: {
      type: String,
    },
    service: {
      type: String,
      enum: [
        "paraphrase",
        "bypass",
        "grammar",
        "summarize",
        "copywrite",
        "translator",
        "meeting_minutes",
        "ai-detector",
      ],
    },
    hits: {
      type: Number,
      default: 0,
    },
    word_count: {
      type: Number,
      default: 0,
    },
    model: {
      type: String,
      default: "panda",
    },
  },
  {
    timestamps: true,
  }
);

const UsageHistoryModel = mongoose.model("usages-history", usageSchema);
module.exports = { UsageHistoryModel };
