const mongoose = require("mongoose");

const humanizeUsesSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true,
    },
    output: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    model: {
      type: String,
      enum: ["panda", "raven"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const HumanizeUsesModel = mongoose.model("HumanizeUses", humanizeUsesSchema);
module.exports = HumanizeUsesModel;
