const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const path = require("path");
const fs = require("fs");
const { Storage } = require("@google-cloud/storage");
const ApiFeatures = require("../lib/ApiFeatures");
const { GOOGLE_GEOLOCATION_KEY } = require("../config/constant");
const { default: axios } = require("axios");
const { Transection } = require("../mongo/models/UserTransection");
const { default: mongoose } = require("mongoose");
const {
  saveSubscribeLogs,
  SubscribeLogs,
} = require("../mongo/models/SubscribeLogs");
const { MeetingSettingsModel } = require("../mongo/models/MeetingSettings");
const Affiliate = require("../mongo/models/affiliate");
const storage = new Storage({
  keyFilename: path.join(__dirname, "..", "cred", "service_account.json"),
});

// const bucket = storage.bucket("shothik"); // Old- not working now
const bucket = storage.bucket("shothik-public-assets");

module.exports.getProfile = async (req, res) => {
  const { _id } = req.user;

  const user = await User.findOne({ _id: _id }).select("-__v -password");

  if (user) {
    return res.json(user);
  }
  res.status(400).json({ message: "User not found " });
};

module.exports.updateProfile = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.id);
  const newData = req.body;
  const { _id } = req.user;
  const user = await User.findOne({ _id: _id });

  if (!user) {
    return res.status(400).send("User not found.");
  }

  const updatedData = { ...user.toObject(), ...newData };

  await User.findByIdAndUpdate(userId, updatedData);

  return res
    .status(200)
    .json({ message: "Profile updated", data: updatedData });
};

module.exports.uploadImage = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  if (!req.files.image) {
    throw Error("upload file to save");
  }

  const name = req.files.image.name;
  const ext = String(name).split(".").pop();
  const uploadPath = __dirname + "/" + name;
  const filename = `assets/${Date.now().toString() + "." + ext}`;

  try {
    const imageFile = req.files.image;
    await imageFile.mv(uploadPath);

    const fileBuffer = fs.readFileSync(uploadPath);

    const file = bucket.file(filename);
    await file.save(fileBuffer, {
      metadata: { contentType: `image/${ext}` },
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    // remove file from local
    fs.unlinkSync(uploadPath);

    return res.status(200).json({ image: publicUrl });
  } catch (error) {
    console.error(`Error on Finished: ${error}`);
    return res.status(500).json({
      message: "Error uploading image to Google Cloud Storage",
      error: error.message,
    });
  } finally {
    // remove file from local
    if (fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath);
    }
  }
};

module.exports.getUserList = async (req, res) => {
  try {
    const { keyword, country } = req.query;
    let perPage;

    if (req.query && typeof req.query.limit === "string") {
      perPage = parseInt(req.query.limit, 10);
    }

    // Construct the search criteria
    const searchCriteria = {};
    if (keyword) {
      searchCriteria.name = keyword;
    }
    if (country) {
      searchCriteria.country = country;
    }

    const count = await User.countDocuments(searchCriteria);

    const apiFeature = new ApiFeatures(
      User.find(searchCriteria)
        .select("-__v -password")
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
      if (country) {
        nextUrl += `&country=${country}`;
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

module.exports.getUserInfo = async (req, res) => {
  const { id } = req.params;

  const user = await User.findOne({ _id: id }).select("-__v -password");

  if (user) {
    return res.status(200).json({ success: true, data: user });
  }
  res.status(400).json({ message: "User not found " });
};

module.exports.userLocation = async (_, res) => {
  try {
    const geoRes = await axios.post(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_GEOLOCATION_KEY}`
    );
    const { lat, lng } = geoRes.data.location;

    const locationRes = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_GEOLOCATION_KEY}`
    );
    const country = locationRes.data.results
      .find((result) => result.types.includes("country"))
      .formatted_address.toLowerCase();

    res.send(country);
  } catch (error) {
    console.error("Error fetching location data:", error);
    res.status(500).send("Error fetching location data");
  }
};

module.exports.checkPackageExpiry = async (req, res) => {
  const currentDate = new Date();
  try {
    const users = await User.find({ package: { $ne: "free" } });

    for (let user of users) {
      const transections = await Transection.find({
        userId: user._id,
        status: { $ne: "pending" },
      }).select("-payload -userId -__v");

      if (!transections || transections.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No transactions found" });
      }

      const latestTransaction = transections[transections.length - 1];
      const validTilDate = new Date(latestTransaction.validTil);

      if (currentDate > validTilDate) {
        console.log(user, latestTransaction, currentDate > validTilDate);
        user.package = "free";
        await user.save();
        await saveSubscribeLogs({
          user: user._id,
          transection: latestTransaction._id,
          status: "success",
          message: `${user.email} package update success`,
        });
      }
    }
    res
      .status(200)
      .json({ success: true, message: "User packages updated successfully" });
  } catch (error) {
    await saveSubscribeLogs({
      status: "failed",
      message: `${error.message} failed at time${currentDate}`,
      payload: error,
    });
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.getSubscribeLogs = async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const logs = await SubscribeLogs.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $lookup: {
          from: "transections",
          localField: "transection",
          foreignField: "_id",
          as: "transactionDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $unwind: "$transactionDetails",
      },
      {
        $project: {
          status: 1,
          message: 1,
          payload: 1,
          createdAt: 1,
          "userDetails.name": 1,
          "userDetails.email": 1,
          "transactionDetails.details": 1,
        },
      },
    ]);

    console.log("Today's logs:", logs);
    res.send(logs);
  } catch (error) {
    console.error("Error fetching today's logs:", error.message);
    return res.send(error.message);
  }
};

module.exports.getMeetingSettings = async (req, res) => {
  const userId = req.id;
  try {
    const meetingsSettings = await MeetingSettingsModel.findOne({
      user: userId,
    }).exec();
    if (!meetingsSettings) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting settings not found" });
    }

    res.status(200).json({ success: true, data: meetingsSettings });
  } catch (error) {
    console.error("Error fetching meeting settings:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.updateSettings = async (req, res) => {
  const userId = req.id;
  const newData = req.body;

  try {
    const updatedSettings = await MeetingSettingsModel.findOneAndUpdate(
      { user: userId },
      { $set: newData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Settings updated or created",
      data: updatedSettings,
    });
  } catch (error) {
    console.error(
      "Error updating or creating meeting settings:",
      error.message
    );
    return res.status(500).json({ success: false, message: error.message });
  }
};

// getAdminInfo function
module.exports.getUserInformation = async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email }).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "user not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//postAffiliateUser function
module.exports.postAffiliateUser = async (req, res) => {
  try {
    const { email, name } = req.body;
    const isExist = await Affiliate.findOne({ email });
    if (isExist) {
      return res.status(400).json({
        success: false,
        message: `A record already exist is under ${isExist.status}`,
      });
    }
    const user = await Affiliate.create({
      email,
      name,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//getAffiliateUser function
module.exports.getAffiliateUsers = async (req, res) => {
  try {
    const user = await Affiliate.find();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};




exports.getUsersUsingAPI_KEY = async (req, res) => {
  try {
    const SERVER_API_KEY = process.env.API_KEY;
    const { api_key, page = 1, pageSize = 10 } = req.query;

    // Validate API key
    if (!api_key || api_key !== SERVER_API_KEY) {
      return res.status(401).json({ message: 'Invalid or missing API_KEY' });
    }

    // Parse pagination params
    const pageInt = Math.max(1, parseInt(page, 10));
    const sizeInt = Math.max(1, parseInt(pageSize, 10));
    const skip = (pageInt - 1) * sizeInt;
    const limit = sizeInt;

    // Total count
    const count = await User.countDocuments({});

    // Fetch paginated results with only the allowed fields
    const rows = await User.find({})
      .select('_id name email address city state zipCode country')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(count / limit);
    // build a relative base path, e.g. "/api/user/get-users-list"
    const basePath = `${req.baseUrl}${req.path}`;
    const makeUrl = targetPage =>
      targetPage >= 1 && targetPage <= totalPages
        ? `${basePath}?api_key=${api_key}&page=${targetPage}&pageSize=${sizeInt}`
        : null;

    return res.json({
      count,
      totalPages,
      page:     pageInt,
      pageSize: sizeInt,
      next:     makeUrl(pageInt + 1),
      previous: makeUrl(pageInt - 1),
      results:  rows
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
