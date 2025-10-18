const ApiFeatures = require("../lib/ApiFeatures");
const { Transection } = require("../mongo/models/UserTransection");
const { saveAdminActivity } = require("../mongo/models/AdminActivity");

// All Transection List
module.exports.getAllTransactions = async (req, res) => {
  try {
    const keyword = req.query.keyword;
    let perPage;

    if (req.query && typeof req.query.limit === "string") {
      perPage = parseInt(req.query.limit, 10);
    }

    const count = await Transection.countDocuments(keyword ? { keyword } : {});

    const apiFeature = new ApiFeatures(
      Transection.find()
        .select("-__v")
        .sort({ createdAt: -1, _date: -1 })
        .populate({
          path: "userId",
          select: "-password",
        }),
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
      .json({ success: false, message: "Internel server error" });
  }
};

module.exports.getValidateTransaction = async (req, res) => {
  try {
    const { userId, packageName } = req.params;

    if (!userId || !packageName) {
      throw { message: "Invalid Request" };
    }

    const transaction = await Transection.findOne({
      userId: userId,
      status: "success",
      package: packageName,
      validTil: { $gte: new Date() },
    })
      .sort({ _id: -1 })
      .exec();

    if (!transaction) {
      throw { message: "Invalid Transaction" };
    }

    res.send(transaction);
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// All Transection List by User
module.exports.getUserTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const keyword = req.query.keyword;
    let perPage;

    if (req.query && typeof req.query.limit === "string") {
      perPage = parseInt(req.query.limit, 10);
    }

    const count = await Transection.countDocuments(
      keyword ? { $and: [{ keyword }, { userId: id }] } : { userId: id }
    );
    const apiFeature = new ApiFeatures(
      Transection.find({ userId: id })
        .select("-__v")
        .sort({ createdAt: -1, _date: -1 })
        .populate({
          path: "userId",
          select: "-password",
        }),
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
      .json({ success: false, message: "Internel server error" });
  }
};

// Change Transection Status
module.exports.updateTransactionStatus = async (req, res) => {
  const trxId = req.params.id;
  try {
    const { status } = req.body;
    const transection = await Transection.findById(trxId).exec();
    if (!transection) {
      return res
        .status(404)
        .json({ success: false, message: "Transection not found" });
    }

    let validTil = new Date();
    if (transection?.plan.toLowerCase() === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
    } else if (transection?.plan.toLowerCase() === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
    } else {
      throw new Error("Invalid subscription type");
    }

    transection.status = status;
    if (status === "success") {
      transection.validTil = validTil;
    }
    await transection.save();

    res
      .status(200)
      .json({ success: true, message: `Change status to ${status}` });

    saveAdminActivity(req.id, `Change payment status`);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internel server error" });
  }
};
