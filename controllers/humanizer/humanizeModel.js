const axios = require("axios");
const uuidv4 = require("uuid").v4;
const { HumanizeContent } = require("../../mongo/models/HumanizeText");
const { redis } = require("../../lib/Redis");
const { TrackUsage } = require("../../lib/TrackUsage");
const { PackagePermission } = require("../../lib/PackagePermission");
const { saveErrorLog } = require("../../mongo/models/ErrorLogs");
const { saveUsagesLogs } = require("../../mongo/models/UsageLogs");
const {
  BYPASS_URL,
  RUNPOD_API_KEY,
  ENDPOINT_ID,
} = require("../../config/constant");
const { permission } = require("../../permissions/permission");

const responses = new Map();

module.exports.humanizeModel = async (req, res) => {
  const userEmail = req?.user?.email || "";
  const text = req.body.text;

  if (!text) {
    throw {
      message: "Required fields not present",
      error: "invalid-argument",
    };
  }

  try {
    // ========== Check usage API hit and word limit permission========
    const { wordLimit, todayWordUsed, totalWordLimit } =
      await PackagePermission(
        req.id,
        req.userIp,
        req.browserAgent,
        req.package,
        "bypass"
      );

    if (req.user) {
      // Check API limit for authenticated users
      // if (todayApiUsed >= apiLimit) {
      //   return res.status(429).json({
      //     success: false,
      //     message: "Bypass limit exceeded",
      //     error: "LIMIT_REQUEST",
      //   });
      // }
      if (totalWordLimit !== 99999 && todayWordUsed >= totalWordLimit) {
        return res.status(429).json({
          success: false,
          message: "Humanized words limit exceeded",
          error: "LIMIT_REQUEST",
        });
      }
      // Check word limit for authenticated users
      if (String(text)?.split(" ")?.length > wordLimit) {
        return res.status(429).json({
          success: false,
          message: `You can't use more than ${wordLimit} words`,
          error: "LIMIT_REQUEST",
        });
      }
    } else {
      // Check API limit for non-authenticated users
      // if (todayApiUsed >= 5) {
      //   return res.status(429).json({
      //     success: false,
      //     message: "Bypass limit exceeded",
      //     error: "LIMIT_REQUEST",
      //   });
      // }
      if (todayWordUsed >= permission.without_login.bypass.total_word) {
        return res.status(429).json({
          success: false,
          message: "Humanized words limit exceeded",
          error: "LIMIT_REQUEST",
        });
      }

      // Check word limit for non-authenticated users
      if (
        String(text)?.split(" ")?.length > permission.without_login.bypass.word
      ) {
        return res.status(429).json({
          success: false,
          message: `You can't use more than ${permission.without_login.bypass.word} words`,
          error: "LIMIT_REQUEST",
        });
      }
    }

    //========== Implement the logic for bypass here =============

    const level = req.body.level || 4;

    if (level === 8) {
      const response = await axios.post(
        "https://az-api.shothik.ai/bypass/humanize",
        {
          text,
        }
      );
      const variants = Object.values(response.data?.variants) || [];
      const data = [];
      const score = [];

      variants.forEach((item) => {
        data.push(item.text);
        score.push(item.score);
      });

      return res.json({
        success: true,
        data,
        score,
      });
    }

    const response = await RunPodBypass(text);
    const firstResponse = response.response[0];
    const data = {
      response: firstResponse,
    };

    // save Usage
    TrackUsage(req, {
      service: "bypass",
      word_count: String(text).split(" ").length,
    });

    // save UsageLogs
    if (req.user) {
      saveUsagesLogs(req.id, text, response, data, "bypass");
    }

    const texts = [];
    const scores = [];
    if (response.response.length) {
      response.response.forEach((item, i) => {
        const text = item;
        const score = Math.floor(Math.random() * (97 - 80 + 1)) + 80;
        texts.push(text);
        scores.push(score);
      });
    }

    return res.json({
      success: true,
      data: texts,
      score: scores,
    });
  } catch (error) {
    console.log(error.message);
    saveErrorLog(error.message, "high", {}, "bypass", userEmail);
    return res.status(500).json({ message: error.message });
  }
};

async function huggingFaceBypass(data) {
  try {
    let finalResponse;

    // First request
    const response = await fetch(
      "https://t1kohsvrcyqihw0i.us-east-1.aws.endpoints.huggingface.cloud",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer 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",
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    // Check if the first response is successful
    if (response.status === 200) {
      const result = await response.json();

      // Prepare data for the second request
      const newData = {
        inputs: result.response, // Using the response from the first request
        parameters: {}, // Add any parameters if needed
      };

      // Second request
      const res = await fetch(
        "https://t1kohsvrcyqihw0i.us-east-1.aws.endpoints.huggingface.cloud",
        {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer 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",
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify(newData),
        }
      );

      // Check if the second response is successful
      if (res.status === 200) {
        finalResponse = await res.json();
      } else {
        throw new Error(
          `Failed in the second request with status: ${res.status}`
        );
      }
    } else {
      throw new Error(
        `Failed in the first request with status: ${response.status}`
      );
    }

    return finalResponse;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Humanize with salad
function SaladByPass(input) {
  return new Promise((resolve, reject) => {
    let data = JSON.stringify({
      inputs: input,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://plum-taco-rqj4i4pl4frfpyv8.salad.cloud/bypass?api_key=1234",
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };

    axios
      .request(config)
      .then((response) => {
        resolve(response.data); // Resolve with the response data
      })
      .catch((error) => {
        reject(error); // Reject with the error if something goes wrong
      });
  });
}

// Humanize with Run Pond
async function RunPodBypass(text) {
  const runpodSdk = await import("runpod-sdk");
  const runpod = runpodSdk.default(RUNPOD_API_KEY);
  const endpoint = runpod.endpoint(ENDPOINT_ID);

  try {
    const result = await endpoint.runSync({
      input: { prompt: text },
    });
    return result.output;
  } catch (error) {
    console.error("Error processing Runpod request:", error);
    throw error;
  }
}

// Business Logic Function
async function processBusinessLogic(text) {
  try {
    const response = await axios.post(
      BYPASS_URL,
      {
        input_text: text,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (response.status === 200) {
      // await storeInDB(response.data);
      return { data: response.data };
    } else {
      throw new Error(response.data.detail || "An unexpected error occurred.");
    }
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data.detail ||
          `Error: ${error.response.status} ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error("No response received from the server.");
    } else {
      throw new Error(`Request failed: ${error.message}`);
    }
  }
}

function combineAlternateSentences(data) {
  const sentences = data;
  const combinedSentences = [];

  // Iterate over the alternatives
  for (let i = 0; i < sentences[0].alternatives.length; i++) {
    let combined = "";

    // Combine alternate sentences pairwise
    sentences.forEach((sentence) => {
      combined += sentence.alternatives[i] + " ";
    });

    // Push the combined sentence to the result array
    combinedSentences.push(combined.trim());
  }

  return combinedSentences;
}

async function storeInDB(data) {
  try {
    const { sentences } = data;

    const result = Array.from(sentences).filter((sentence) => {
      if (sentence?.original?.length > 3) {
        return true;
      }
      return false;
    });

    const res = await HumanizeContent.insertMany(result);
    const count = await HumanizeContent.countDocuments();
    console.log("Total Count", count);
  } catch (error) {
    console.log(error.message);
    saveErrorLog(error.message, "high", {}, "bypass");
  }
}

// Queue request processing
async function enqueueRequest(requestId, request, res) {
  console.log("Enqueuing request...");
  responses.set(requestId, res); // Store the response object with the request ID
  try {
    await redis.rpush("requests", JSON.stringify({ requestId, request }));
    console.log("Request enqueued:", requestId, request);
  } catch (err) {
    console.error("Failed to enqueue request:", err);
    res
      .status(500)
      .json({ message: "Failed to enqueue request", error: err.toString() });
  }
}

async function processNextRequest() {
  console.log("Checking for next request to process...");
  try {
    const item = await redis.lpop("requests");
    if (item) {
      console.log("Found a request in the queue");
      const { requestId, request } = item;
      console.log("Processing request:", requestId, request);

      // Process business logic
      const processedData = await processBusinessLogic(request.data);
      console.log("Processed data:", processedData);

      // Here you would send the response to the user
      const res = responses.get(requestId);
      if (res) {
        res.json({
          message: "Request processed",
          data: processedData,
        });
        responses.delete(requestId); // Clean up the response map
        console.log("Sent response and cleaned up:", requestId);
      }

      // Check the queue length to decide whether to process immediately or wait
      const queueLength = await redis.llen("requests");
      console.log("Current queue length:", queueLength);
      if (queueLength > 0) {
        // Process the next request immediately if there are more requests
        console.log("Processing the next request immediately");
        setTimeout(processNextRequest, 0); // No wait time for subsequent requests
      } else {
        // Otherwise, wait for new requests to arrive
        console.log("No more requests in queue. Waiting for new requests.");
        setTimeout(processNextRequest, 1000); // Check for new requests every second
      }
    } else {
      console.log("No requests found in queue. Waiting for new requests.");
      setTimeout(processNextRequest, 1000); // Check for new requests every second
    }
  } catch (err) {
    console.error("Error processing request:", err);
    setTimeout(processNextRequest, 1000); // Retry after delay in case of error
  }
}

// Start processing requests
// processNextRequest();
