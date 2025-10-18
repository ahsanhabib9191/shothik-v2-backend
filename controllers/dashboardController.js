const ApiFeatures = require("../lib/ApiFeatures");
const { getDateRange } = require("../lib/getDateRange");
const { getLastDateRange } = require("../lib/getLastDateRange");
const Admin = require("../mongo/models/Admin");
const { AdminActivityModel } = require("../mongo/models/AdminActivity");
const AppModeModel = require("../mongo/models/appModes");
const { ErrorLogs } = require("../mongo/models/ErrorLogs");
const { UsageHistoryModel } = require("../mongo/models/UsageHistory");
const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");

const serviceColors = {
  paraphrase: "#a5f6ad",
  bypass: "#5BE584",
  bangla_grammer: "#00AB55",
  english_grammer: "#00AB55",
  summarize: "#037e3a",
  copywrite: "#007B55",
  translator: "#04641b",
  meeting_minutes: "#007B55",
};

// All User Acquisition Controller
module.exports.AllUserAcquisitionController = async (req, res) => {
  const interval = req.query.interval || "weekly";
  const specificMonth = req.query.month
    ? parseInt(req.query.month) - 1
    : undefined;
  const specificYear = req.query.year ? parseInt(req.query.year) : undefined;

  try {
    const { startDate, endDate } = getDateRange(
      interval,
      specificMonth,
      specificYear
    );

    const acquisitionData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                {
                  case: { $eq: [interval, "weekly"] },
                  then: { $dayOfWeek: "$createdAt" },
                },
                {
                  case: { $eq: [interval, "monthly"] },
                  then: { $dayOfMonth: "$createdAt" },
                },
                {
                  case: { $eq: [interval, "yearly"] },
                  then: { $month: "$createdAt" },
                },
              ],
              default: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const allLabels = {
      weekly: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      monthly: Array.from({ length: 31 }, (_, i) => (i + 1).toString()),
      yearly: Array.from({ length: 12 }, (_, i) =>
        new Date(0, i).toLocaleString("default", { month: "short" })
      ),
    };

    const labels = allLabels[interval];
    const acquisitionMap = acquisitionData.reduce((map, item) => {
      map[item._id] = item.count;
      return map;
    }, {});

    const data = labels.map((label, index) => ({
      label,
      amount: acquisitionMap[index + 1] || 0,
    }));
    res.status(200).json({ success: true, data: data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Paid User Acquisition Controller
module.exports.PaidUserAcquisitionController = async (req, res) => {
  const interval = req.query.interval || "weekly";
  const specificMonth = req.query.month
    ? parseInt(req.query.month) - 1
    : undefined;
  const specificYear = req.query.year ? parseInt(req.query.year) : undefined;
  const plan = req.query.plan ? req.query.plan : undefined;

  try {
    const { startDate, endDate } = getDateRange(
      interval,
      specificMonth,
      specificYear
    );

    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
      package: { $in: ["starter", "premium"] },
    };

    if (plan) {
      matchStage.package = plan;
    }

    const acquisitionData = await User.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                {
                  case: { $eq: [interval, "weekly"] },
                  then: { $dayOfWeek: "$createdAt" },
                },
                {
                  case: { $eq: [interval, "monthly"] },
                  then: { $dayOfMonth: "$createdAt" },
                },
                {
                  case: { $eq: [interval, "yearly"] },
                  then: { $month: "$createdAt" },
                },
              ],
              default: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const allLabels = {
      weekly: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      monthly: Array.from({ length: 31 }, (_, i) => (i + 1).toString()),
      yearly: Array.from({ length: 12 }, (_, i) =>
        new Date(0, i).toLocaleString("default", { month: "short" })
      ),
    };

    const labels = allLabels[interval];
    const acquisitionMap = acquisitionData.reduce((map, item) => {
      map[item._id] = item.count;
      return map;
    }, {});

    const data = labels.map((name, index) => ({
      name,
      uv: acquisitionMap[index + 1] || 0,
    }));

    res.status(200).json({ success: true, data: data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// API Hit distribution
module.exports.ApiHitDistributionController = async (req, res) => {
  let endDate = new Date();
  let startDate = req.query.date ? new Date(req.query.date) : null;

  if (startDate && isSameDate(startDate, endDate)) {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  try {
    const totalHits = await UsageHistoryModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalHits: { $sum: "$hits" },
        },
      },
    ]);

    const distribution = await UsageHistoryModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$service",
          hits: { $sum: "$hits" },
        },
      },
      {
        $project: {
          service: "$_id",
          hits: 1,
          _id: 0,
        },
      },
    ]);

    // Calculate total hits
    const totalApiHits = totalHits[0]?.totalHits || 0;

    // Calculate percentage distribution
    const serviceInPercent = distribution.map((service) => ({
      service: service.service,
      percentage: totalApiHits
        ? ((service.hits / totalApiHits) * 100).toFixed(1)
        : 0,
      fill: serviceColors[service.service] || "#000000",
    }));

    // Previous month's hits
    const previousMonthStartDate = new Date(startDate);
    previousMonthStartDate.setMonth(previousMonthStartDate.getMonth() - 1);
    const previousMonthEndDate = new Date(endDate);
    previousMonthEndDate.setMonth(previousMonthEndDate.getMonth() - 1);

    const previousMonthHits = await UsageHistoryModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousMonthStartDate,
            $lt: previousMonthEndDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalHits: { $sum: "$hits" },
        },
      },
    ]);

    const previousTotalApiHits = previousMonthHits[0]?.totalHits || 0;

    // Calculate the difference as a percentage
    let differenceInPercent = 0;
    if (previousTotalApiHits !== 0) {
      differenceInPercent = (
        ((totalApiHits - previousTotalApiHits) / previousTotalApiHits) *
        100
      ).toFixed(2);
    } else if (totalApiHits > 0) {
      differenceInPercent = 100.0;
    }

    res.status(200).json({
      success: true,
      data: { totalApiHits, differenceInPercent, serviceInPercent },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// service usage usage comparison
module.exports.ServiceUsageComparisonController = async (req, res) => {
  let endDate = new Date();
  let startDate = req.query.date ? new Date(req.query.date) : null;

  if (startDate && isSameDate(startDate, endDate)) {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  try {
    const serviceUsage = await UsageHistoryModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$service",
          hits: { $sum: "$hits" },
        },
      },
      {
        $project: {
          service: "$_id",
          hits: 1,
          _id: 0,
        },
      },
    ]);

    // Format the response data
    const formattedData = serviceUsage.map((service) => ({
      service: service.service,
      hits: service.hits,
    }));

    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin activity list
module.exports.AdminActivityList = async (req, res) => {
  try {
    const { keyword, email } = req.query;
    let perPage;

    if (req.query && typeof req.query.limit === "string") {
      perPage = parseInt(req.query.limit, 10);
    }

    const searchCriteria = {};
    if (keyword) {
      searchCriteria.activity = keyword;
    }
    if (email) {
      searchCriteria["admin.email"] = email;
    }
    console.log(searchCriteria);
    const count = await AdminActivityModel.countDocuments(searchCriteria);

    const apiFeature = new ApiFeatures(
      AdminActivityModel.find(searchCriteria)
        .populate({
          path: "admin",
          select: "name email avatar",
        })
        .sort({ createdAt: -1 }),
      req.query
    )
      .search()
      .filter();

    if (perPage !== undefined) {
      apiFeature.pagination(perPage);
    }

    const result = await apiFeature.query;
    const limit = result.length;

    const currentPage = req.query.page ? parseInt(req.query.page, 10) : 1;

    let totalPages;

    if (perPage !== undefined) {
      totalPages = Math.ceil(count / perPage);
    }

    let nextPage;
    let nextUrl;

    if (perPage !== undefined && currentPage < totalPages) {
      nextPage = currentPage + 1;
      nextUrl = `${
        req.originalUrl.split("?")[0]
      }?limit=${perPage}&page=${nextPage}`;
      if (keyword) {
        nextUrl += `&keyword=${keyword}`;
      }
      if (email) {
        nextUrl += `&email=${email}`;
      }
    }

    res.status(200).json({
      success: true,
      data: result || [],
      total: count,
      perPage,
      limit,
      nextPage,
      nextUrl,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const isSameDate = (date1, date2) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Error Logs Controller
module.exports.errorLogsController = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;

    const skip = (page - 1) * limit;

    const totalLogs = await ErrorLogs.countDocuments();
    const totalPages = Math.ceil(totalLogs / limit);

    const logs = await ErrorLogs.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: logs,
      total: totalLogs,
      page,
      totalPages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.changeAppMode = async (req, res) => {
  try {
    const { appMode, description } = req.body;

    const isExist = await AppModeModel.findOne({ isActive: true });

    if (!isExist) {
      await AppModeModel.create({
        appMode,
        description,
      });
    } else {
      isExist.appMode = appMode;
      isExist.description = description;
      await isExist.save();
    }

    return res.status(200).json({
      success: true,
      data: appMode,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Controller functions for getting mode info
module.exports.getModeController = async (req, res) => {
  try {
    // Get current mode
    const currentMode = await AppModeModel.findOne({
      isActive: true,
    });

    if (!currentMode) {
      const data = await AppModeModel.create({
        appMode: "live",
        isActive: true,
        description: "Production mode",
      });
      return res.status(200).json({
        success: true,
        data: data,
      });
    }

    return res.status(200).json({
      success: true,
      data: currentMode,
    });
  } catch (error) {
    console.error("Error getting server mode:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
