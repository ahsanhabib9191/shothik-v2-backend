const { Schema, model } = require("mongoose");

const betaListSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const BetaListModel = model("BetaList", betaListSchema);

module.exports = BetaListModel;