const {
  User,
} = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { Transection } = require("../mongo/models/UserTransection");

const validPackage = async (req, res, next) => {
  try {
    if (req.package === "free" || !req.package) {
      return next();
    }

    if (!req.is_verified) {
      return res.status(401).json({
        error: "NOT_VERFIED",
        message: "Your email is not verified yet, please verify first.",
      });
    }

    const transections = await Transection.findOne({
      userId: req.id,
      status: "success",
    })
      .select("-payload -userId -__v")
      .sort({ createdAt: -1 })
      .limit(1);

    if (!transections) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "No transactions found",
      });
    }

    const currentDate = new Date();
    const validTilDate = new Date(transections.validTil);

    if (currentDate.getTime() <= validTilDate.getTime()) {
      return next();
    } else {
      // here we can down the package or we can send email to user for renew the package
      transections.status = "expired";
      await transections.save();
      const user = await User.findById(req.id);
      user.package = "free";
      await user.save();
      next();
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = validPackage;
