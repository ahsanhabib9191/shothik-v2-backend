const { ShareSettings, ShareAnalytics } = require("../mongo/models/ShareSlide");
const {
  generateShareLink,
  updateShareSettings,
  getAnalytics,
  accessSharedPresentation,
} = require("../services/shareService");

const generateShareLinkController = async (req, res) => {
  try {
    const { presentationId } = req.params;
    const userId = req.id; // Assuming auth middleware sets req.user
    const shareSettings = await generateShareLink(userId, presentationId);
    res.status(200).json({
      shareLink: shareSettings.shareLink,
      settings: {
        isDiscoverable: shareSettings.isDiscoverable,
        requireSignIn: shareSettings.requireSignIn,
        allowComments: shareSettings.allowComments,
        allowDownload: shareSettings.allowDownload,
        trackViews: shareSettings.trackViews,
        expiryDate: shareSettings.expiryDate,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateShareSettingsController = async (req, res) => {
  try {
    const { presentationId } = req.params;
    const userId = req.id;
    const settings = req.body;
    const updatedSettings = await updateShareSettings(
      userId,
      presentationId,
      settings
    );
    res.status(200).json(updatedSettings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAnalyticsController = async (req, res) => {
  try {
    const { presentationId } = req.params;
    const userId = req.id;
    const analytics = await getAnalytics(userId, presentationId);
    res.status(200).json({ analytics });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const accessSharedPresentationController = async (req, res) => {
  try {
    const { shareLink } = req.params;
    const { password } = req.query;
    const clientIp = req.ip;
    const userId = req.id || req.query.token || null;
    console.log(shareLink, password, clientIp, userId);
    const { presentation, shareId, settings, trackViews } =
      await accessSharedPresentation(shareLink, password, clientIp, userId);
    res.status(200).json({ presentation, shareId, settings, trackViews });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const trackView = async (req, res) => {
  try {
    const { shareId } = req.params;
    const clientIp = req.ip; // Or use userId if authenticated
    let analytics = await ShareAnalytics.findOne({ shareId });
    if (!analytics) {
      analytics = new ShareAnalytics({ shareId });
    }
    analytics.views += 1;
    if (!analytics.uniqueVisitors.includes(clientIp)) {
      analytics.uniqueVisitors.push(clientIp);
    }
    analytics.lastViewed = new Date();
    analytics.updatedAt = new Date();
    await analytics.save();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Track view error:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
};

module.exports = {
  generateShareLink: generateShareLinkController,
  updateShareSettings: updateShareSettingsController,
  getAnalytics: getAnalyticsController,
  accessSharedPresentation: accessSharedPresentationController,
  trackView,
};
