const { ShareSettings, ShareAnalytics } = require("../mongo/models/ShareSlide");
// const Presentation = require("../models/presentation"); // Assume exists
const Redis = require("ioredis");
const { redisConfig } = require("../lib/Redis");
const bcrypt = require("bcryptjs");
const { default: axios } = require("axios");
const redis = new Redis(redisConfig);

const agentBaseUrl = process.env.PRESENTATION_AGENT_BASE_URL;

const generateShareLink = async (userId, presentationId) => {
//   const presentation = await Presentation.findOne({
//     _id: presentationId,
//     userId,
//   });

    console.log("userId from share service", userId);
  
  const presentation = await axios.get(
        `${agentBaseUrl}/slides/?p_id=${presentationId}`,
      );

  if (!presentation) {
    throw new Error("Presentation not found or not authorized");
  }

  const existingShare = await ShareSettings.findOne({ presentationId, userId });
  if (existingShare) {
    return existingShare;
  }

  const uniqueId = Math.random().toString(36).slice(2, 9);
  const shareLink = `${
    process.env.CLIENT_URI || "http://localhost:3000"
  }/shared/${uniqueId}`;

  const shareSettings = new ShareSettings({
    presentationId,
    userId,
    shareLink,
    isDiscoverable: false,
    requireSignIn: false,
    allowComments: true,
    allowDownload: true,
    trackViews: true,
  });

  await shareSettings.save();

  // Cache share settings
  await redis.setex(
    `share:${uniqueId}`,
    24 * 60 * 60,
    JSON.stringify(shareSettings)
  );

  return shareSettings;
};

const updateShareSettings = async (userId, presentationId, settings) => {
  const shareSettings = await ShareSettings.findOne({ presentationId, userId });
  if (!shareSettings) {
    throw new Error("Share settings not found");
  }

  Object.assign(shareSettings, settings);
  await shareSettings.save();

  // Update cache
  await redis.setex(
    `share:${shareSettings.shareLink.split("/").pop()}`,
    24 * 60 * 60,
    JSON.stringify(shareSettings)
  );

  return shareSettings;
};

const getAnalytics = async (userId, presentationId) => {
  const shareSettings = await ShareSettings.findOne({ presentationId, userId });
  if (!shareSettings) {
    throw new Error("Share settings not found");
  }

  const analytics = await ShareAnalytics.findOne({
    shareId: shareSettings._id,
  });
  if (!analytics) {
    return { views: 0, uniqueVisitors: 0, lastViewed: null };
  }

  return {
    views: analytics.views,
    uniqueVisitors: analytics.uniqueVisitors.length,
    lastViewed: analytics.lastViewed,
  };
};

const accessSharedPresentation = async (
  shareLink,
  password,
  clientIp,
  userId
) => {
  try {
    const cacheKey = `share:${shareLink}`;
    let shareSettings = await redis.get(cacheKey);

    if (!shareSettings) {
      shareSettings = await ShareSettings.findOne({
        shareLink: `${
          process.env.CLIENT_URI || "http://localhost:3000"
        }/shared/${shareLink}`,
      });
      if (!shareSettings) {
        throw new Error("Invalid share link");
      }
      await redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(shareSettings));
    } else {
      shareSettings = JSON.parse(shareSettings);
    }

    if (shareSettings.requireSignIn && !userId) {
      throw new Error("Sign-in required to access this presentation");
    }

    if (
      shareSettings.password &&
      (!password || !(await bcrypt.compare(password, shareSettings.password)))
    ) {
      throw new Error("Invalid password");
    }

    if (
      shareSettings.expiryDate &&
      new Date() > new Date(shareSettings.expiryDate)
    ) {
      throw new Error("Share link has expired");
    }

    const presentationResponse = await axios.get(
      `${agentBaseUrl}/slides/?p_id=${shareSettings.presentationId}`
    );

    // Extract the presentation data from the Axios response
    const presentation = presentationResponse.data;

    if (!presentation) {
      throw new Error("Presentation not found");
    }

    return {
      presentation, // Use only the data part
      shareId: shareSettings._id,
      settings: shareSettings,
      trackViews: shareSettings.trackViews,
    };
  } catch (error) {
    console.error("Error in accessSharedPresentation:", error);
    throw new Error("Failed to access shared presentation");
  }
};

module.exports = {
  generateShareLink,
  updateShareSettings,
  getAnalytics,
  accessSharedPresentation,
};
