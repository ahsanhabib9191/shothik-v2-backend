const { default: mongoose } = require("mongoose");
const { Pricing } = require("../mongo/models/Pricing");
const { PricingFeature } = require("../mongo/models/PricingFeatures");

module.exports.AddPricing = async (req, res) => {
  const { title, type, currency, bn, global } = req.body;
  try {
    // Check if pricing type is valid
    if (!["free", "basic", "starter", "premium"].includes(type)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid pricing type" });
    }

    const pricingData = new Pricing({
      title,
      type,
      currency,
      bn,
      global,
      in: req.body.in,
    });

    const newPricing = await pricingData.save();

    res
      .status(201)
      .json({ success: true, message: "Pricing Added", data: newPricing });
  } catch (error) {
    console.error("Error creating pricing entry:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// Pricing list
module.exports.PricingList = async (req, res) => {
  const pricing = await Pricing.find({
    isDeleted: false,
  });
  res.json({
    message: "Pricing List",
    data: pricing,
  });
};

// pricing edit
module.exports.PricingEdit = async (req, res) => {
  const pricingId = new mongoose.Types.ObjectId(req.params.id);
  const newData = req.body;
  if (!pricingId) {
    throw Error("Id is required");
  }

  const pricing = await Pricing.findById(pricingId);
  if (!pricing) {
    throw Error("Pricing not found");
  }

  const updatedData = { ...pricing.toObject(), ...newData };

  await Pricing.findByIdAndUpdate(pricingId, updatedData);

  res.status(200).json({
    success: true,
    message: "Pricing Updated",
    data: updatedData,
  });
};

// delete pricing
module.exports.PricingDelete = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw Error("Id is required");
  }

  const pricing = await Pricing.findOne({ _id: id });
  if (!pricing) {
    throw Error("Pricing not found");
  }

  pricing.isDeleted = true;

  await pricing.save();

  res.json({
    message: "Pricing Deleted",
    data: pricing,
  });
};

// Add Pricing Feature
module.exports.addPricingFeature = async (req, res) => {
  const { title, limit, word_limit, pricingId, type, mode, total_word } =
    req.body;

  // not id
  if (!pricingId) {
    throw Error("Pricing Id is required");
  }

  // validation
  if (!title) {
    throw Error("Title is required");
  }

  if (!type) {
    throw Error("Type is required");
  }

  if (!limit) {
    throw Error("Limit is required");
  }

  if (!word_limit) {
    throw Error("Limit is required");
  }

  if (!total_word) {
    throw Error("Limit is required");
  }

  // check existing
  const pricing = await PricingFeature.findOne({
    pricingId,
    title,
    isDeleted: false,
  });
  if (pricing) {
    throw Error("Feature already exists");
  }

  // check id exists
  const pricingExists = await Pricing.findOne({ _id: pricingId });
  if (!pricingExists) {
    throw Error("Pricing not found");
  }

  const feature = await PricingFeature.create({
    pricingId,
    title,
    limit,
    word_limit,
    type,
    mode,
    total_word,
  });

  // return response
  res.json({
    message: "Pricing Feature Added",
    data: feature,
  });
};

// Pricing Feature List
module.exports.PricingFeatureList = async (req, res) => {
  // aggregation
  const features = await Pricing.aggregate([
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $project: {
        isDeleted: 0,
      },
    },
    {
      $lookup: {
        from: "pricing_features",
        localField: "_id",
        foreignField: "pricingId",
        as: "features",
        pipeline: [
          {
            $match: {
              isDeleted: false,
            },
          },
          {
            $project: {
              isDeleted: 0,
            },
          },
          {
            $sort: {
              sl: 1, // Sort the pricing_features by sl
            },
          },
        ],
      },
    },
    {
      $sort: {
        sl: 1, // Sort the Pricing pricing by sl
      },
    },
  ]);

  const data = [];
  features.forEach((feature) => {
    const item = feature;
    const global = item.global;
    global.amount_monthly = parseFloat(global.amount_monthly);
    global.amount_yearly = parseFloat(global.amount_yearly);
    item.global = global;
    data.push(item);
  });

  res.json({
    message: "Pricing Feature List",
    data,
  });
};

// delete pricing feature
module.exports.PricingFeatureDelete = async (req, res) => {
  const featureId = new mongoose.Types.ObjectId(req.params.id);
  if (!featureId) {
    throw Error("Id is required");
  }

  const feature = await PricingFeature.findOne(featureId);
  if (!feature) {
    throw Error("Feature not found");
  }

  feature.isDeleted = true;

  await feature.save();

  res.json({
    message: "Feature Deleted",
    data: feature,
  });
};

// full delete pricing feature
module.exports.PricingFeatureFullDelete = async (req, res) => {
  const featureId = new mongoose.Types.ObjectId(req.params.id);

  await PricingFeature.findOneAndDelete(featureId);

  res.json({
    succes: true,
    message: "Feature Deleted",
  });
};

// pricing pricing feature
module.exports.PricingFeatureEdit = async (req, res) => {
  const featureId = new mongoose.Types.ObjectId(req.params.id);
  const newData = req.body;
  if (!featureId) {
    throw Error("Id is required");
  }

  const feature = await PricingFeature.findById(featureId);
  if (!feature) {
    throw Error("feature not found");
  }

  const updatedData = { ...feature.toObject(), ...newData };

  await PricingFeature.findByIdAndUpdate(featureId, updatedData);

  res.status(200).json({
    success: true,
    message: "feature updated",
    data: updatedData,
  });
};
