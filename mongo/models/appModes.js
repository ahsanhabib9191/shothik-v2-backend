const mongoose = require("mongoose");

const appModeSchema = new mongoose.Schema(
  {
    appMode: {
      type: String,
      enum: ["dev", "test", "live"],
      default: "dev",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const AppModeModel = mongoose.model("AppMode", appModeSchema);
module.exports = AppModeModel;
