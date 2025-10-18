const { UsageHistoryModel } = require("../mongo/models/UsageHistory");

async function TrackUsage(req, { service, word_count, model = "panda" }) {
  try {
    // Check if service and usage are provided
    if (!service || word_count === 0) {
      return;
    }

    const { session_id } = req?.query;
    const browserAgent = req.browserAgent;
    const userId = req.id;
    const IP = req.userIp;
    const package = req.package;
    let track;
    // Save usage history
    if (req.user) {
      track = await UsageHistoryModel.create({
        isRegistered: true,
        ipAddress: IP,
        userId: userId,
        package: package,
        browser_agent: browserAgent,
        session_id: session_id,
        service: service,
        hits: 1,
        word_count: word_count,
        model: model,
      });
    } else {
      track = await UsageHistoryModel.create({
        isRegistered: false,
        ipAddress: IP,
        userId: null,
        package: null,
        browser_agent: browserAgent,
        session_id: session_id,
        service: service,
        hits: 1,
        word_count: word_count,
      });
    }

    console.log("Usage tracked successfully:", track?.ipAddress);
  } catch (error) {
    console.error("Error tracking usage:", error);
  }
}

module.exports = {
  TrackUsage,
};
