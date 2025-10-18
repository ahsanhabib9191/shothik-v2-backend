const mongoose = require("mongoose");

const usagesLogsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  type: {
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
  userInput: {
    type: mongoose.Schema.Types.Mixed,
  },
  processedData: {
    type: mongoose.Schema.Types.Mixed,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
  },
  model: {
    type: String,
    default: "panda",
  },
});

const UsagesLogsModel = mongoose.model("UsagesLogs", usagesLogsSchema);

// Define the function to save usage logs
async function saveUsagesLogs(
  userId,
  userInput,
  processedData,
  result,
  type,
  model = "panda"
) {
  try {
    const newLog = new UsagesLogsModel({
      userId,
      userInput,
      processedData,
      result,
      type,
      model,
    });
    await newLog.save();

    console.log("Usage log saved successfully.");
  } catch (error) {
    console.error("Error saving usage log:", error);
  }
}

// Export the model and the function
module.exports = {
  UsagesLogsModel,
  saveUsagesLogs,
};
