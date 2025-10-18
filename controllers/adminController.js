const Admin = require("../mongo/models/Admin");
const { saveAdminActivity } = require("../mongo/models/AdminActivity");
const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { Pricing } = require("../mongo/models/Pricing");
const { default: mongoose } = require("mongoose");
const { Transection } = require("../mongo/models/UserTransection");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// registration
module.exports.register = async (req, res) => {
  try {
    var { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // email valide or not
    var emailRegEx = /\S+@\S+\.\S+/;
    if (!emailRegEx.test(email)) {
      return res.status(400).json({ message: "Email is invalid" });
    }

    // Check if the user is already in the database
    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const newAdmin = new Admin({ name, email, password, role });

    // Save user
    await newAdmin.save();

    // Generate a JWT token
    const token = newAdmin.getJWTToken();

    saveAdminActivity(newAdmin._id, "Create a new account");

    // Return the token
    res.status(201).json({
      success: true,
      data: { id: newAdmin._id, role: newAdmin.role, token },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login controller
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and Password are required" });
    }

    // Validate email format
    var emailRegEx = /\S+@\S+\.\S+/;
    if (!emailRegEx.test(email)) {
      return res.status(400).json({ message: "Email is invalid" });
    }

    // Check if admin exists
    const admin = await Admin.findOne({ email }).select("+password");
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (admin.status === "inactive") {
      return res.status(401).json({ message: "Your account is inactive" });
    }

    // Compare passwords
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = admin.getJWTToken();

    saveAdminActivity(admin._id, `Login by ${admin.name}`);

    // Return the token
    res.status(200).json({
      success: true,
      data: { id: admin._id, role: admin.role, token },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports.createPremiumUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let transactionCommitted = false;
  let package = "premium";

  try {
    let { name, email, password, payment_type } = req.body;
    payment_type = payment_type || "yearly";
    if (payment_type == "monthly") {
      package = "starter";
    }

    // validation name
    if (!name || name === "") {
      return res.status(400).json({ message: "Name is required" });
    }
    var nameRegEx = /^[a-zA-Z .]+$/;
    if (!nameRegEx.test(name)) {
      return res
        .status(400)
        .json({ message: "Only alphabets and . are allowed in the name" });
    }

    // validation email
    if (!email || email === "") {
      return res.status(400).json({ message: "Email is required" });
    }
    var emailRegEx = /\S+@\S+\.\S+/;
    if (!emailRegEx.test(email)) {
      return res.status(400).json({ message: "Email is invalid" });
    }

    // Check if the user is in the database
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // create new user
    user = new User({
      name,
      email,
      password,
      auth_type: "manual",
      package: package,
      is_verified: true,
    });
    await user.save({ session });

    const pricingId = "65f86defcdffda093352badd";
    const existPricing = await Pricing.findById(
      new mongoose.Types.ObjectId(pricingId)
    );
    if (!existPricing) {
      throw new Error("Pricing is invalid");
    }

    let validTil = new Date();
    if (payment_type === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
    } else if (payment_type === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
    }

    const transaction = new Transection({
      userId: user._id.toString(),
      amount: existPricing.global.amount_yearly,
      package: existPricing.type,
      plan: payment_type,
      validTil,
      status: "success",
      paymentMethod: "stripe",
    });
    await transaction.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    transactionCommitted = true; // Mark as committed

    // Create Stripe session after the MongoDB transaction is committed
    await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: existPricing.title,
            },
            unit_amount: Math.ceil(existPricing.global.amount_yearly * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://shothik.ai/payment/success",
      cancel_url: "https://shothik.ai/payment/failed",
      metadata: {
        pricingId,
        package: existPricing?.type,
        userId: user._id.toString(),
        amount: existPricing.global.amount_yearly,
        type: payment_type,
        transactionId: transaction._id.toString(),
      },
    });

    res.status(201).json({
      success: true,
      message: "Premium user created successfully",
      user,
      transaction,
    });
  } catch (error) {
    if (!transactionCommitted) {
      // Only abort if the transaction wasn't committed
      await session.abortTransaction();
    }
    console.error("Error in createPremiumUserWithPayment:", error);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// upgrade upgradeUserInformation function
module.exports.upgradeUserInformation = async (req, res) => {
  try {
    const { email, package, duration: plan } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // return res.json({ success: true, data: user });

    user.package = package;

    const validTil = new Date();
    if (plan === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
    } else if (plan === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
    }

    // add a transection
    const transection = await Transection.create({
      userId: user._id,
      amount: 0,
      package: package,
      plan,
      paymentMethod: "manual",
      status: "success",
      validTil,
    });

    await user.save();
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//get all admins
module.exports.getAllAdmins = async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = { _id: { $ne: req.id } };
    if (role) {
      query.role = role;
    }
    if (search) {
      query["$or"] = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const admins = await Admin.find(query);

    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// active and inactive admin
module.exports.activeAndInactiveAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (/admin|editor/.test(req.role) && admin.role === "super_admin") {
      return res
        .status(400)
        .json({ message: "You can't change the status of this user" });
    }

    admin.status = status;
    await admin.save();

    res.status(200).json({ message: "Admin status updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to update admin status" });
  }
};

//user user role
module.exports.changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }

    if (/admin|editor/.test(req.role)) {
      if (admin.role === "super_admin") {
        return res
          .status(400)
          .json({ message: "You can't change the role of this user" });
      }
      if (role === "super_admin") {
        return res
          .status(400)
          .json({ message: "You can't change the role of this user" });
      }
    }

    admin.role = role;
    await admin.save();

    res.status(200).json({ message: "User role updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to update user role" });
  }
};

// add admin;
module.exports.addAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (/editor/.test(req.role)) {
      return res.status(400).json({ message: "You can't add an admin" });
    }

    const admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const newAdmin = new Admin({ name, email, password, role });
    await newAdmin.save();
    res.status(201).json({ message: "Admin added successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Unable to add admin" });
  }
};
