const axios = require('axios');
const uuidv4 = require("uuid").v4;
const { StealthToken } = require('../../mongo/models/StealthToken');
const { HumanizeContent } = require('../../mongo/models/HumanizeText');
const { redis } = require('../../lib/Redis');
const { TrackUsage } = require('../../lib/TrackUsage');
const { PackagePermission } = require('../../lib/PackagePermission');
const { permission } = require('../../permissions/permission');
const { saveErrorLog } = require('../../mongo/models/ErrorLogs');
const { saveUsagesLogs } = require('../../mongo/models/UsageLogs');
const { removeUndefined } = require('../../lib/helper');

const responses = new Map();

const humanize_with_stealth = async (req, res) => {
    const userEmail = req?.user?.email || '';
    try {
        const text = req.body.text;

        // ========== Check usage API hit and word limit permission========
        const { todayApiUsed, apiLimit, wordLimit } = await PackagePermission(req.id, req.userIp, req.browserAgent, req.package, 'bypass')
        if (req.user) {
            // check API limit 
            if (todayApiUsed >= apiLimit) {
                return res.status(429).json({ success: false, message: "Bypass query limit exceeded for today! Please upgrade your account", error: 'LIMIT_REQUEST', });
            }
            // check word limit 
            if ((String(text)?.split(' ')?.length) > wordLimit) {
                return res.status(429).json({ success: false, message: `You can't use more than ${wordLimit} words`, error: 'LIMIT_REQUEST', });
            }
        } else {
            return res.status(429).json({ success: false, message: "You can't use bypass without login", error: 'LIMIT_REQUEST', });
        }

        //========== Implement the logic for bypass here =============

        const requestId = uuidv4();
        const request = { data: req.body.text };
        console.log("Generated requestId:", requestId);
        await enqueueRequest(requestId, request, res);
        console.log("Request received and enqueued:", requestId, request.data);

        const { data, cleanOutPut } = await processBusinessLogic(text);

        // save Usage
        TrackUsage(req, {
            service: "bypass",
            word_count: String(text).split(' ').length,
        })

        // save UsageLogs
        if (req.user) {
            saveUsagesLogs(req.id, text, data, data.sentences, 'bypass');
        }

        return res.json({
            data: cleanOutPut,
            output: data.sentences
        })

    } catch (error) {
        console.log(error.message)
        saveErrorLog(error.message, 'high', {}, 'bypass', userEmail);
        return res.status(500).json({ message: error.message });
    }
}

function combineAlternateSentences(data) {
    const sentences = data;
    const combinedSentences = [];

    // Iterate over the alternatives
    for (let i = 0; i < sentences[0].alternatives.length; i++) {
        let combined = '';

        // Combine alternate sentences pairwise
        sentences.forEach(sentence => {
            combined += sentence.alternatives[i] + ' ';
        });

        // Push the combined sentence to the result array
        combinedSentences.push(combined.trim());
    }

    return combinedSentences;
}

async function storeInDB(data) {
    try {
        const { sentences } = data;

        const result = Array.from(sentences).filter(sentence => {
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
        saveErrorLog(error.message, 'high', {}, 'bypass');
    }
}

// Business Logic Function
async function processBusinessLogic(text) {
    // find token
    const account = await StealthToken.findOne({});

    if (!account) {
        throw new Error('Server is not ready yet. Please try again later.');
    }

    const { data } = await axios.post(
        'https://api5.stealthwriter.ai/humanizetemp',
        {
            'text': text,
            'params': {
                'level': 10,
                'model': 'ninja'
            }
        },
        {
            headers: {
                'accept-language': 'en-US,en;q=0.9,bn;q=0.8',
                'authorization': `Bearer ${account.token}`,
                'origin': 'https://stealthwriter.ai',
                'priority': 'u=1, i',
                'referer': 'https://stealthwriter.ai/',
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        }
    );

    const output = combineAlternateSentences(data.sentences);
    const cleanOutPut = removeUndefined(output);
    await storeInDB(cleanOutPut);
    return { data, cleanOutPut };
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
        res.status(500).json({ message: "Failed to enqueue request", error: err.toString() });
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

module.exports = {
    humanize_with_stealth
}
