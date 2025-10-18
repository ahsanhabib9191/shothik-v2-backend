const mongoose = require("mongoose");

const sentenceSchema = new mongoose.Schema(
  {
    sentence: {
      type: String,
      required: true,
    },
    analysis: [
      {
        word: { type: String, required: true },
        type: { type: String, required: true },
        synonyms: { type: [String], default: [] },
      },
    ],
  },
  { timestamps: true }
);

const paraphraseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    synonymLevel: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      required: true,
    },
    freezeWord: {
      type: String,
      required: false,
      default: "",
    },
    output: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: function (array) {
          return array.every((item) => typeof item === "string");
        },
        message: "Output must be an array of strings",
      },
    },
  },
  { timestamps: true }
);

const SentenceModel = mongoose.model("Sentence", sentenceSchema);
const ParaphraseModel = mongoose.model("ParaphraseModel", paraphraseSchema);
module.exports = { SentenceModel, ParaphraseModel };
