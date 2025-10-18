const { UsageHistoryModel } = require("../mongo/models/UsageHistory");
const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { Transection } = require("../mongo/models/UserTransection");

async function updateTransaction(transactionId, type, userId, package) {
  try {
    console.log("payment transaction Update start...");
    let validTil = new Date();
    if (type.toLowerCase() === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
      validTil.setHours(23, 59, 59, 999);
    } else if (type.toLowerCase() === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
      validTil.setHours(23, 59, 59, 999);
    } else {
      throw new Error("Invalid subscription type");
    }
    const transaction = await Transection.findOne({ _id: transactionId });

    const user = await User.findOne({ _id: userId });

    if (!transaction) {
      console.error("Transaction not found");
      throw new Error("Transaction not found");
    }

    if (!user) {
      console.error("user not found");
      throw new Error("User not found");
    }

    const isExistPlan = await Transection.findOne({
      userId: userId,
      status: "success",
      validTil: { $gte: new Date() },
    })
      .sort({ _id: -1 })
      .exec();

    if (isExistPlan) {
      await UsageHistoryModel.updateMany(
        { userId: userId, package: { $ne: "free" } },
        { $set: { package: package } }
      );
    }

    transaction.status = "success";
    transaction.validTil = validTil;

    await transaction.save();

    user.package = package;
    await user.save();

    console.log("payment success");
  } catch (error) {
    throw { message: "Transaction saving failed" };
  }
}

module.exports = {
  updateTransaction,
};
