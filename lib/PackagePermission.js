const { default: mongoose } = require("mongoose");
const { UsageHistoryModel } = require("../mongo/models/UsageHistory");
const { Pricing } = require("../mongo/models/Pricing");
const { PricingFeature } = require("../mongo/models/PricingFeatures");
// const { dateRangeBuild } = require("./dateRangeBuild");

async function PackagePermission(
  userId,
  iP,
  browserAgent,
  package,
  service,
  model = "panda"
) {
  const userID = new mongoose.Types.ObjectId(userId);
  const currentDate = new Date();

  let startOfDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    1,
    0
  );

  let endOfDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    23,
    59,
    0
  );

  if (
    service === "ai-detector" ||
    (service === "bypass" && model === "raven")
  ) {
    console.log("hitting monthly usages");
    startOfDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    endOfDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
  }

  try {
    const matchQuery = {
      service: service,
      createdAt: {
        $gte: startOfDate,
        $lt: endOfDate,
      },
    };

    if (userId) {
      matchQuery.userId = userID;
    } else {
      matchQuery.ipAddress = iP;
      matchQuery.userId = null;
    }

    if (package) {
      matchQuery.package = package;
      matchQuery.model = model;
    }

    const pipeline = [
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: null,
          totalHits: { $sum: "$hits" },
          totalWordCount: { $sum: "$word_count" },
        },
      },
    ];

    const result = await UsageHistoryModel.aggregate(pipeline);
    const todayApiUsed = result[0]?.totalHits || 0;
    const todayWordUsed = result[0]?.totalWordCount || 0;
    let apiLimit = 0;
    let wordLimit = 0;
    let totalWordLimit = 0;
    let modes = [];

    if (userId) {
      const pricing = await Pricing.findOne({
        type: package,
        isDeleted: false,
      }).exec();

      if (!pricing) {
        throw {
          message: "Unauthorized access",
          error: "UNAUTHORIZED",
        };
      }

      const pricingFeature = await PricingFeature.findOne({
        pricingId: pricing?._id,
        type: service,
        model,
      }).exec();

      if (!pricingFeature) {
        const msg =
          model === "raven"
            ? "You  can't use this Model"
            : "There is no feature available for this user";
        throw {
          message: msg,
          error: "LIMIT_REQUEST",
        };
      }

      apiLimit = pricingFeature.limit;
      wordLimit = pricingFeature.word_limit;
      totalWordLimit = pricingFeature.total_word;
      modes = pricingFeature.mode;
      model = pricingFeature.model;
    }

    console.log(
      "===SERVICE: ",
      service,
      ", ===User: ",
      userId,
      ", ===IP: ",
      iP,
      ", ===Limit: ",
      apiLimit,
      ", ===API Used: ",
      todayApiUsed,
      ", ===WordUsed: ",
      todayWordUsed,
      ", ===TotalWordLimit: ",
      totalWordLimit,
      ", ===WordLimit: ",
      wordLimit,
      ", ===modes: ",
      modes,
      ", ===model: ",
      model,
      ", ===package: ",
      package
    );

    return {
      todayApiUsed,
      apiLimit,
      wordLimit,
      modes,
      model,
      todayWordUsed,
      totalWordLimit,
    };
  } catch (error) {
    console.error("Error fetching total usage stats of package:", error);
    throw error;
  }
}

module.exports = {
  PackagePermission,
};
