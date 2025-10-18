const { queueClient } = require("../config/queueClient");
const { ShareAnalytics } = require("../mongo/models/ShareSlide");

queueClient.consumeMessages("analytics-queue", async (message) => {
  const data = JSON.parse(message);
  const { type, shareId, clientIp, userId } = data;

  if (type === "INIT_ANALYTICS") {
    const analytics = new ShareAnalytics({
      shareId,
      views: 0,
      uniqueVisitors: [],
      lastViewed: null,
    });
    await analytics.save();
    console.log(`Initialized analytics for share ID ${shareId}`);
  } else if (type === "UPDATE_ANALYTICS") {
    const analytics = await ShareAnalytics.findOne({ shareId });
    if (analytics) {
      analytics.views += 1;
      const visitorId = userId || clientIp;
      if (!analytics.uniqueVisitors.includes(visitorId)) {
        analytics.uniqueVisitors.push(visitorId);
      }
      analytics.lastViewed = new Date();
      analytics.updatedAt = new Date();
      await analytics.save();
      console.log(`Updated analytics for share ID ${shareId}`);
    }
  }
});
