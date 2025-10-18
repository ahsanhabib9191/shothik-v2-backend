const BetaListModel = require("../mongo/models/betaList");

async function registerUserToBetaList(req, res) {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({
        message: "Missing Email",
      });

    await BetaListModel.create({ email });

    return res.status(201).json({
      message: "Successfully registered to beta-list.",
    });
  } catch (error) {
    console.log("[registerUserToBetaList] error when registering user", error);

    // Handle duplicate email error (MongoDB duplicate key error)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    // Handle other errors
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

module.exports = registerUserToBetaList;