const mongoose = require("mongoose");

const humanizeHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index for faster queries
    },
    input: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      enum: ["panda", "raven"],
      required: true,
    },
    level: {
      type: String,
      enum: ["Basic", "Intermediate", "Advanced", "Expert"],
      required: true,
    },
    outputs: [
      {
        text: {
          type: String,
          required: true,
        },
        score: {
          type: Number,
          required: true,
        },
        isPlexibity: {
          type: Number,
          default: 0.5,
        },
        aiPercentage: {
          type: Number,
        },
        aiAssessment: {
          type: String,
        },
        totalSentences: {
          type: Number,
        },
        averageWordsPerSentence: {
          type: Number,
        },
        originalParagraphNumber: {
          type: Number,
        },
        rank: {
          type: Number,
        },
      },
    ],
    metadata: {
      totalParagraphsAnalyzed: {
        type: Number,
      },
      bestAiPercentage: {
        type: Number,
      },
      processingMethod: {
        type: String,
        enum: ["ai-scored", "fallback"],
      },
    },
    wordCount: {
      type: Number,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user history queries
humanizeHistorySchema.index({ userId: 1, createdAt: -1 });

const HumanizeHistoryModel = mongoose.model(
  "HumanizeHistory",
  humanizeHistorySchema
);

module.exports = HumanizeHistoryModel;
