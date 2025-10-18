const mongoose = require("mongoose");

const grammarSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
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
  },
  {
    timestamps: { createdAt: "timestamp", updatedAt: false },
  }
);

// Compound index for efficient user history queries
grammarSchema.index({ userId: 1, createdAt: -1 });

const GrammarModel = mongoose.model("Grammar", grammarSchema);

module.exports = GrammarModel;
