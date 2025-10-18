const mongoose = require("mongoose");

const SentenceSchema = new mongoose.Schema({
  highlight_sentence_for_ai: {
    type: Boolean,
    required: false,
    default: false,
  },
  human_confidence: {
    type: Number,
    required: false,
  },
  perplexity: {
    type: Number,
    required: false,
  },
  sentence: {
    type: String,
    required: true,
  },
});

const aiDetectorSchema = new mongoose.Schema(
  {
    sentences: {
      type: [SentenceSchema],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // indexing for faster queries.
    },
    ai_detected_sentences: {
      type: Number,
      required: true,
    },
    ai_percentage: {
      type: Number,
      required: true,
    },
    assessment: {
      type: String,
      required: true,
    },
    average_ai_confidence: {
      type: Number,
      required: false,
    },
    average_perplexity: {
      type: Number,
      required: false,
    },
    average_words_per_sentence: {
      type: Number,
      required: true,
    },
    total_sentences: {
      type: Number,
      required: true,
    },
    total_words: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

aiDetectorSchema.index({ userId: 1, createdAt: -1 });

const aiDetectorModal = mongoose.model("aiDetector", aiDetectorSchema);

module.exports = aiDetectorModal;
