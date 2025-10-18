const { redis } = require("../../lib/Redis");
const {
  GeminiAPIkeys,
  GeminiModel,
  DailyUsage,
} = require("../../mongo/models/geminiAPIkeys");
const { AskAiStudio } = require("./aistudio");
const { callAPiKey } = require("./gemini-api-call");

const log = (message) =>
  console.log(`[${new Date().toISOString()}] ${message}`);

const apiKeyCache = "api-key-cache";

const ChooseAPIKey = async (modelName) => {
  log(`ChooseAPIKey: Started for ${modelName}`);

  //   Flash full db of redis

  const match = { status: "active" };
  let keys = [];

  if (modelName === "gemini-2.0-flash") {
    match.is_premium = true;
  } else {
    const cacheKeys = await redis.get(apiKeyCache);
    if (cacheKeys !== null) {
      keys = cacheKeys;
    }
  }

  // console.log('Keys=================> ', keys);

  // check if the key is in the cache
  if (keys !== null) {
    if (keys.length > 0) {
      // this keys will be ignored
      match._id = { $nin: keys };
    }
  }

  // take all the api keys
  // const apiKeys = await GeminiAPIkeys.find(match).sort({ _id: 1 }).select('apiKey _id status');
  const apiKey = await GeminiAPIkeys.findOne(match);

  if (apiKey) {
    console.log("API Key Found");
    // make it inactive
    const totalUsed = apiKey.totalUsed + 1;
    await GeminiAPIkeys.findOneAndUpdate(
      { _id: apiKey._id },
      { $set: { status: "inactive", lastUsed: new Date(), totalUsed } }
    );

    // update daily usage
    updateDailyUsage(apiKey._id);

    if (modelName === "gemini-2.0-flash-exp") {
      // update api key count
      keys.push(apiKey._id);
    }
    await addIdToCache(keys);

    return apiKey.apiKey;
  } else {
    // and Model name is
    if (modelName === "gemini-2.0-flash-exp") {
      // remove all the keys from cache
      await redis.remove(apiKeyCache);
    }
  }

  // reset all the key to inactive
  await GeminiAPIkeys.updateMany({ status: "active" });

  // return same function
  return ChooseAPIKey(modelName);
};

// Add id to cache
async function addIdToCache(keys) {
  if (keys.length === 0) {
    return;
  }

  console.log("Keys ==================", keys);
  // expire in 1 hour
  await redis.set(apiKeyCache, keys, 3600);
}

async function updateDailyUsage(apiKeyId) {
  try {
    const today = new Date()
      .toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "-");

    console.log(`Updating daily usage for ${apiKeyId} on ${today}`);

    const result = await DailyUsage.findOneAndUpdate(
      {
        apiKeyId: apiKeyId,
        date: today,
      },
      {
        $inc: { total_used: 1 },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(`Updated daily usage for ${apiKeyId} on ${today}`);
    return result;
  } catch (error) {
    console.error(
      `Error updating daily usage for ${apiKeyId}: ${error.message}`
    );
    throw error;
  }
}

async function updateAPIKeyCount(apiKeyId) {
  try {
    // log
    log(`updateAPIKeyCount: Updating API key count for ${apiKeyId}`);
    await GeminiAPIkeys.findByIdAndUpdate(apiKeyId, { $inc: { totalUsed: 1 } });
  } catch (error) {
    log(
      `updateAPIKeyCount: Error updating API key count for ${apiKeyId}: ${error.message}`
    );
  }
}

module.exports = {
  ChooseAPIKey,
};

// Function to check Every API Key
async function checkAPIKeys() {
  const apiKeys = await GeminiAPIkeys.find();

  for (let api of apiKeys) {
    console.log("Checking API Key: ", api.apiKey, api._id);
    await checkKey(api.apiKey);
  }
}

async function checkKey(apiKey, id) {
  try {
    const response = await callAPiKey(apiKey, "hello world");
    console.log(response);
  } catch (error) {
    console.log("Error Limit");
    // Disable the API key
    // await GeminiAPIkeys.findByIdAndUpdate(id, { status: "inactive" });
    const model = await GeminiAPIkeys.findOne({ _id: id });
    if (model) {
      console.log("Saving...");
      model.status = "inactive";
      await model.save();
      console.log("Saved...");
    }
  }
}

// checkAPIKeys()
