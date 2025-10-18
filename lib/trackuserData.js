const { saveUsagesLogs } = require("../mongo/models/UsageLogs");
const { TrackUsage } = require("./TrackUsage");

const trackUserData = async (req, service, options) => {
  try {
    // Save usage
    TrackUsage(req, {
      service,
      word_count: String(options.input).split(" ").length,
    });

    // Log user usage if logged in
    saveUsagesLogs(req.id, options.input, options.output, options, service);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  trackUserData,
};
