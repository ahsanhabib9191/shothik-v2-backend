const mongoose = require("mongoose");

const grammarHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    grammar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Grammar",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    model: {
      type: String,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user history queries
grammarHistorySchema.index({ userId: 1, createdAt: -1 });

const GrammarHistoryModel = mongoose.model(
  "GrammarHistory",
  grammarHistorySchema
);

module.exports = GrammarHistoryModel;
