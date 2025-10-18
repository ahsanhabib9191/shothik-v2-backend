const { default: mongoose } = require("mongoose");
const { Pricing } = require("../mongo/models/Pricing");
const { UsageHistoryModel } = require("../mongo/models/UsageHistory");
const { PricingFeature } = require("../mongo/models/PricingFeatures");
const { PackagePermission } = require("../lib/PackagePermission");

module.exports.UserLimit = async (req, res) => {
  const permissions = await Pricing.aggregate([
    {
      $lookup: {
        from: "pricing_features", // Name of the collection for PricingFeature
        localField: "_id",
        foreignField: "pricingId",
        as: "pricing_features",
      },
    },
  ]);
  return res.json(permissions);
};

module.exports.usesLimit = async (req, res) => {
  try {
    const { service, model = "panda" } = req.body;

    const { totalWordLimit, todayWordUsed } = await PackagePermission(
      req.id,
      req.userIp,
      req.browserAgent,
      req.package,
      service,
      model
    );
    return res.json({
      totalWordLimit,
      todayWordUsed,
      remainingWord: totalWordLimit - todayWordUsed,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
