const { default: axios } = require("axios");
const mongoose = require("mongoose");

const errorLogsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  email: {
    type: String,
  },
  message: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: "",
  },
  remark: {
    type: String,
    default: "",
  },
  source: {
    type: String,
    default: "",
  },
});

const ErrorLogs = mongoose.model("ErrorLogs", errorLogsSchema);

// Async function to save error logs
async function saveErrorLog(
  message,
  severity = "medium",
  payload,
  source,
  email
) {
  if (typeof message !== "string" || message.trim() === "") {
    console.error("Invalid error message provided.");
    return;
  }

  if (!["low", "medium", "high"].includes(severity)) {
    console.error("Invalid severity level provided.");
    return;
  }

  try {
    const errorLog = new ErrorLogs({
      message,
      severity,
      payload,
      source,
      email,
    });
    await errorLog.save();
    const SLACK_ERROR_HOOK_URL = process.env.SLACK_ERROR_HOOK_URL;

    // Send a notification to Slack;
    const slackMessage = {
      text: `*Error Logged:*\n- *Message:* ${message}\n- *Severity:* ${severity}\n- *Source:* ${source}\n- *User:* ${
        email || "Without login user"
      }\n- *Date:* ${new Date().toLocaleString()}`,
    };
    await axios.post(SLACK_ERROR_HOOK_URL, slackMessage);
  } catch (error) {
    console.error("Error occurred while saving error log:", error.message);
  }
}

module.exports = {
  ErrorLogs,
  saveErrorLog,
};
