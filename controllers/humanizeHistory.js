const { default: mongoose } = require("mongoose");
const HumanizeHistoryModel = require("../mongo/models/HumanizeHistory");

/**
 * Get user's humanize history with pagination
 * @route GET /api/humanize/history
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 10)
 * @query model - Filter by model (optional)
 * @query level - Filter by level (optional)
 */
module.exports.getHumanizeHistory = async (req, res) => {
  try {
    const userId = req.id; // From auth middleware

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { userId };

    if (req.query.model) {
      filter.model = req.query.model;
    }

    if (req.query.level) {
      filter.level = req.query.level;
    }

    // Get total count for pagination
    const totalCount = await HumanizeHistoryModel.countDocuments(filter);

    // Fetch history with pagination
    const history = await HumanizeHistoryModel.find(filter)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .select("-__v") // Exclude version key
      .lean(); // Convert to plain JavaScript objects

    res.send({
      success: true,
      data: history,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching humanize history:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch history",
      error: error.message,
    });
  }
};

/**
 * Get a single history item by ID
 * @route GET /api/humanize/history/:id
 */
module.exports.getHumanizeHistoryById = async (req, res) => {
  try {
    const userId = req.id;
    const historyId = req.params.id;

    const history = await HumanizeHistoryModel.findOne({
      _id: historyId,
      userId: userId, // Ensure user can only access their own history
    })
      .select("-__v")
      .lean();

    if (!history) {
      return res.status(404).send({
        success: false,
        message: "History not found",
      });
    }

    res.send({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching history by ID:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch history",
      error: error.message,
    });
  }
};

/**
 * Delete a history item
 * @route DELETE /api/humanize/history/:id
 */
module.exports.deleteHumanizeHistory = async (req, res) => {
  try {
    const userId = req.id;
    const historyId = req.params.id;

    const result = await HumanizeHistoryModel.deleteOne({
      _id: historyId,
      userId: userId, // Ensure user can only delete their own history
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "History not found or already deleted",
      });
    }

    res.send({
      success: true,
      message: "History deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting history:", error);
    res.status(500).send({
      success: false,
      message: "Failed to delete history",
      error: error.message,
    });
  }
};

/**
 * Get user's humanize statistics
 * @route GET /api/humanize/stats
 */
module.exports.getHumanizeStats = async (req, res) => {
  try {
    const userId = req.id;

    const stats = await HumanizeHistoryModel.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalHumanizations: { $sum: 1 },
          totalWords: { $sum: "$wordCount" },
          avgOutputs: { $avg: { $size: "$outputs" } },
          modelBreakdown: {
            $push: "$model",
          },
          levelBreakdown: {
            $push: "$level",
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalHumanizations: 1,
          totalWords: 1,
          avgOutputs: { $round: ["$avgOutputs", 2] },
          pandaCount: {
            $size: {
              $filter: {
                input: "$modelBreakdown",
                cond: { $eq: ["$$this", "panda"] },
              },
            },
          },
          ravenCount: {
            $size: {
              $filter: {
                input: "$modelBreakdown",
                cond: { $eq: ["$$this", "raven"] },
              },
            },
          },
        },
      },
    ]);

    res.send({
      success: true,
      data: stats[0] || {
        totalHumanizations: 0,
        totalWords: 0,
        avgOutputs: 0,
        pandaCount: 0,
        ravenCount: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching humanize stats:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};
