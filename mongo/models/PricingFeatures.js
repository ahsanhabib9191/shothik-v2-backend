const { Schema, model } = require("mongoose");
const schema = new Schema({
  pricingId: {
    type: Schema.Types.ObjectId,
    ref: "pricing",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      "paraphrase",
      "bypass",
      "summarize",
      "translator",
      "meeting_minutes",
      "grammar",
      "ai-ditector",
    ],
  },
  limit: {
    type: Number,
  },
  word_limit: {
    type: Number,
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: [String],
    default: [],
  },
  model: {
    type: String,
    default: "panda",
  },
  total_word: {
    type: Number,
    required: true,
  },
  sl: {
    type: Number,
    required: true,
    default: 0,
  },
});
// model
const PricingFeature = model("pricing_features", schema);
module.exports = {
  PricingFeature,
};
