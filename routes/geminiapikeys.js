const {
  GeminiAPIkeys,
  GeminiModel,
  DailyUsage,
} = require("../mongo/models/geminiAPIkeys");
const express = require("express");
const { isGeminiWorking } = require("../test/test.gemini.api");
const router = express.Router();

// **GeminiAPIkeys Routes**
// Get all API keys
router.get("/api-keys", async (req, res, next) => {
  try {
    const data = await GeminiAPIkeys.find({});
    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create a new API key
router.post("/api-key", async (req, res, next) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).send({
        success: false,
        message: "apiKey is required",
      });
    }

    const existingKey = await GeminiAPIkeys.findOne({ apiKey });
    if (existingKey) {
      return res.status(400).send({
        success: false,
        message: "apiKey already exists",
      });
    }

    // make a test gemini call to check if the API key is valid
    const { success } = await isGeminiWorking(apiKey);
    if (!success) {
      return res.status(400).send({
        success: false,
        message: "apiKey is not valid",
      });
    }

    const lastIndex = await GeminiAPIkeys.findOne().sort({
      keyIndex: -1,
    });

    const newIndex = lastIndex ? lastIndex.keyIndex + 1 : 0;

    const data = await GeminiAPIkeys.create({
      apiKey,
      keyIndex: newIndex,
    });

    // Create default models for the new API key
    addDefaultModels(data._id);

    return res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get a single API key by ID
router.get("/api-keys/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await GeminiAPIkeys.findById(id);
    if (!data) {
      return res.status(404).send({
        success: false,
        message: "API key not found",
      });
    }
    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update API key by ID
router.put("/api-keys/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { apiKey, status, keyIndex } = req.body;

    const data = await GeminiAPIkeys.findByIdAndUpdate(
      id,
      { apiKey, status, keyIndex },
      { new: true }
    );
    if (!data) {
      return res.status(404).send({
        success: false,
        message: "API key not found",
      });
    }

    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete API key by ID
router.delete("/api-keys/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await GeminiAPIkeys.findByIdAndDelete(id);

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "API key not found",
      });
    }

    res.send({ success: true, message: "API key deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// **GeminiModel Routes**
// Get all models
router.get("/models", async (req, res, next) => {
  try {
    const data = await GeminiModel.find({}).populate("apiKeyId");
    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create a new model
router.post("/models", async (req, res, next) => {
  try {
    const { name, rpm, total_limit, apiKeyId } = req.body;

    if (!name || !rpm || !total_limit || !apiKeyId) {
      return res.status(400).send({
        success: false,
        message: "name, rpm, total_limit, and apiKeyId are required",
      });
    }

    const existingModel = await GeminiModel.findOne({ apiKeyId, name });
    if (existingModel) {
      return res.status(400).send({
        success: false,
        message: "Model with same apiKeyId and name already exists",
      });
    }

    const data = await GeminiModel.create({ name, rpm, total_limit, apiKeyId });
    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get a single model by ID
router.get("/models/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await GeminiModel.find({ apiKeyId: id });

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Model not found",
      });
    }

    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update model by ID
router.put("/models/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, rpm, total_limit, apiKeyId } = req.body;

    const data = await GeminiModel.findByIdAndUpdate(
      id,
      { name, rpm, total_limit, apiKeyId },
      { new: true }
    );

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Model not found",
      });
    }

    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete model by ID
router.delete("/models/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await GeminiModel.findByIdAndDelete(id);

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Model not found",
      });
    }

    res.send({ success: true, message: "Model deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// **DailyUsage Routes**
// Get all daily usages
router.get("/daily-usage", async (req, res, next) => {
  try {
    const { apiKeyId } = req.query;
    const data = await DailyUsage.find({ apiKeyId });
    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create a new daily usage entry
router.post("/daily-usage", async (req, res, next) => {
  try {
    const { apiKeyId, total_used, date } = req.body;

    if (!apiKeyId || !total_used || !date) {
      return res.status(400).send({
        success: false,
        message: "apiKeyId, total_used, and date are required",
      });
    }

    const data = await DailyUsage.create({ apiKeyId, total_used, date });
    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Update daily usage by ID
router.put("/daily-usage/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { total_used } = req.body;

    const data = await DailyUsage.findByIdAndUpdate(
      id,
      { total_used },
      { new: true }
    );

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Daily usage not found",
      });
    }

    res.send({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Delete daily usage by ID
router.delete("/daily-usage/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await DailyUsage.findByIdAndDelete(id);

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Daily usage not found",
      });
    }

    res.send({ success: true, message: "Daily usage deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// Add All the Gemini Default Models to DB by API Key
router.post("/add-default-models", async (req, res, next) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).send({
        success: false,
        message: "apiKey is required",
      });
    }

    const existingKey = await GeminiAPIkeys.findOne({ apiKey });
    if (!existingKey) {
      return res.status(400).send({
        success: false,
        message: "apiKey not found",
      });
    }

    // check already exist or not
    const dfModel = await GeminiModel.find({ apiKeyId: existingKey._id });
    if (dfModel.length > 0) {
      return res.status(400).send({
        success: false,
        message: "Default models already added",
      });
    }

    const data = await addDefaultModels(existingKey._id);
    // return all the default models by API Key
    const models = await GeminiModel.find({
      apiKeyId: existingKey._id,
    }).populate("apiKeyId");
    res.send({ success: true, data, models });
  } catch (error) {
    next(error);
  }
});

function addDefaultModels(apiKey) {
  return new Promise(async (resolve, reject) => {
    try {
      const defaultModels = [
        {
          name: "gemini-2.0-flash",
          rpm: 15,
          total_limit: 1500,
          apiKeyId: apiKey,
        },
        {
          name: "gemini-1.5-pro",
          rpm: 15,
          total_limit: 1500,
          apiKeyId: apiKey,
        },
        {
          name: "gemini-2.0-flash-8b",
          rpm: 15,
          total_limit: 1500,
          apiKeyId: apiKey,
        },
        {
          name: "gemini-2.0-flash-exp",
          rpm: 15,
          total_limit: 1500,
          apiKeyId: apiKey,
        },
      ];

      // first check if all the models exist one by one
      for (const model of defaultModels) {
        const existingModel = await GeminiModel.findOne({
          apiKeyId: apiKey,
          name: model.name,
        });
        if (existingModel) {
          continue;
        }

        await GeminiModel.create(model);
      }

      resolve({ success: true });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

// call the default models add function
async function callDefaultModelsAdd() {
  try {
    const keys = await GeminiAPIkeys.find({});
    for (const key of keys) {
      // check if the key has default models added or not
      const models = await GeminiModel.find({ apiKeyId: key._id });
      if (models.length > 0) {
        continue;
      }

      await addDefaultModels(key._id);
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = router;
