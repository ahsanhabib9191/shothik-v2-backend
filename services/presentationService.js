// services/presentationService.js
const { default: axios } = require("axios");
const { queueClient, QUEUE_TYPES } = require("../config/queueClient");
const Redis = require("ioredis");
const { redisConfig } = require("../lib/Redis");
const Presentation = require("../mongo/models/PresentaionSchema");
const { broadcastPresentationUpdate } = require("../config/socket");
const axiosRetry = require("axios-retry").default;

const redis = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
});

const agentBaseUrl = process.env.PRESENTATION_AGENT_BASE_URL;

axiosRetry(axios, {
  retries: 10,
  retryDelay: () => 3000, // 3 seconds
  retryCondition: (error) => {
    // Retry on network errors or 5xx responses
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});

// services/presentationService.js
const getAllPresentationSlides = async (userId) => {
  try {
    const metadataKey = `all-presentation_metadata:${userId}`;

    // 1) Try cache
    const cached = await redis.get(metadataKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        data: parsed.data,
        status: parsed.status,
        fetchedAt: parsed.fetchedAt,
        source: 'redis',
      };
    }

    // 2) Fetch from agent
    const agentResponse = await axios.get(
      `${agentBaseUrl}/presentations`,
      {
        params: { user_id: userId },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(agentResponse, "agent get all response");

    const presentations = agentResponse.data;
    const status = agentResponse.status || 'success';

    const result = {
      data: presentations,
      status,
    };

    // 3) Cache for 1 hour
    await redis.set(
      metadataKey,
      JSON.stringify(result),
      'EX',
      60
    );

    return result;
  } catch (error) {
    console.error(
      `[presentationService] getAllPresentationSlides error for user ${userId}:`,
      error
    );
    return {
      data: null,
      status: 'error',
    };
  }
};


const initiatePresentation = async (message, file_urls, userId) => {
  try {

    console.log({ message, file_urls, userId }, "init service");
    const agentResponse = await axios.post(
      `${agentBaseUrl}/create-presentation`,
      { message, file_urls, userId }
    );

    const presentationId = agentResponse?.data?.presentation_id;

    // Create presentation record in database
    const presentation = new Presentation({
      presentationId,
      userId,
      title: "Generating...",
      message,
      status: "initiated",
      queueType: queueClient.getCurrentQueueType(),
      chatHistory: [{ role: "user", content: message, timestamp: new Date() }],
    });

    await presentation.save();

    const taskPayload = {
      presentationId,
      message,
      userId,
      timestamp: new Date().toISOString(),
      queueType: queueClient.getCurrentQueueType(),
      taskType: "initial_creation",
    };

    console.log(
      `[presentationService] Initiating presentation ${presentationId} for user ${userId} using ${queueClient.getCurrentQueueType()}`
    );

    await queueClient.sendMessage("presentation_tasks", taskPayload);

    // Keep Redis metadata for backward compatibility
    const metadataKey = `presentation_metadata:${userId}:${presentationId}`;
    await redis.set(
      metadataKey,
      JSON.stringify({
        id: presentationId,
        userId,
        status: "initiated",
        message,
        queueType: queueClient.getCurrentQueueType(),
        createdAt: new Date().toISOString(),
      }),
      "EX",
      86400
    );

    console.log(
      `[presentationService] Presentation ${presentationId} initiated successfully for user ${userId}`
    );

    return {
      presentationId,
      status: "initiated",
      queueType: queueClient.getCurrentQueueType(),
      userId,
    };
  } catch (error) {
    console.error("[presentationService] initiatePresentation error:", error);
    throw new Error(
      `Failed to initiate presentation for user ${userId}: ${error.message}`
    );
  }
};

const presentationLogs = async (id, userId) => {
  try {
    console.log(
      `[presentationService] Fetching logs for ${id} for user ${userId}`
    );

    // // First try to get from database if presentation is completed
    // const presentation = await Presentation.findByUserAndId(userId, id);

    // if (
    //   presentation &&
    //   presentation.status === "saved" &&
    //   presentation.logs.length > 0
    // ) {
    //   console.log(
    //     `[presentationService] Returning logs from database for ${id}`
    //   );
    //   return {
    //     data: presentation.logs,
    //     status: presentation.status,
    //     queueType: presentation.queueType,
    //     fetchedAt: new Date().toISOString(),
    //     presentationId: id,
    //     userId,
    //     source: "database",
    //   };
    // }

    // If not in database or not completed, fetch from external agent
    // const metadataKey = `presentation_metadata:${userId}:${id}`;
    // const metadata = await redis.get(metadataKey);
    // if (!metadata) {
    //   console.log(`Presentation ${id} not found for user ${userId}`);
    // }

    const agentResponse = await axios.get(
      `${agentBaseUrl}/logs/?p_id=${id}&t=${Date.now()}`,
      {
        timeout: 3600000, // 1 hour in milliseconds
        headers: {
          "Content-Type": "application/json",
          "X-Queue-Type": queueClient.getCurrentQueueType(),
          "Cache-Control": "no-cache",
          "X-Presentation-ID": id,
          "X-User-ID": userId,
        },
      }
    );
    
    const result = {
      data: agentResponse.data.logs || [],
      status: agentResponse.data.status || "N/A",
      queueType: queueClient.getCurrentQueueType(),
      fetchedAt: new Date().toISOString(),
      presentationId: id,
      userId,
      source: "external_agent",
    };

    // const agentData = await fetch(`${agentBaseUrl}/logs/?p_id=${id}&t=${Date.now()}`, {
    //   method: "GET",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "X-Queue-Type": queueClient.getCurrentQueueType(),
    //     "Cache-Control": "no-cache",
    //     "X-Presentation-ID": id,
    //     "X-User-ID": userId,
    //   },
    // });

    // const agentResponse = await agentData.json();

    // console.log(agentResponse.data, "Logs data");

    // for normal fetch
    // const result = {
    //   data: agentResponse.logs || [],
    //   status: agentResponse.status || "N/A",
    //   queueType: queueClient.getCurrentQueueType(),
    //   fetchedAt: new Date().toISOString(),
    //   presentationId: id,
    //   userId,
    //   source: "external_agent",
    // };

    broadcastPresentationUpdate(id, userId, {
      logs: result?.data,
      status: result?.status,
    });

    // Check if presentation is completed and queue for persistence
    if (result.status === "completed" || result.status === "done") {
      await queueCompletedPresentation(id, userId, result.status);
    }

    console.log(
      `[presentationService] Logs fetched for ${id} for user ${userId} using ${queueClient.getCurrentQueueType()}`
    );
    return result;
  } catch (error) {
    console.error("[presentationService] presentationLogs error:", error);
    throw new Error(
      `Failed to fetch presentation logs for ${id} for user ${userId}: ${error.message}`
    );
  }
};

const presentationSlides = async (id, userId) => {
  try {
    console.log(
      `[presentationService] Fetching slides for ${id} for user ${userId}`
    );

    // // First try to get from database if presentation is completed
    // const presentation = await Presentation.findByUserAndId(userId, id);

    // if (
    //   presentation &&
    //   presentation.status === "saved" &&
    //   presentation.slides.length > 0
    // ) {
    //   console.log(
    //     `[presentationService] Returning slides from database for ${id}`
    //   );
    //   return {
    //     data: presentation.slides,
    //     status: presentation.status,
    //     title: presentation.title,
    //     total_slides: presentation.totalSlides,
    //     queueType: presentation.queueType,
    //     fetchedAt: new Date().toISOString(),
    //     presentationId: id,
    //     userId,
    //     source: "database",
    //   };
    // }

    // If not in database or not completed, fetch from external agent
    // const metadataKey = `presentation_metadata:${userId}:${id}`;
    // const metadata = await redis.get(metadataKey);
    // if (!metadata) {
    //   console.log(`Presentation ${id} not found for user ${userId}`);
    // }

    const agentResponse = await axios.get(
      `${agentBaseUrl}/slides/?p_id=${id}&t=${Date.now()}`,
      {
        timeout: 3600000, // 1 hour in milliseconds
        headers: {
          "Content-Type": "application/json",
          "X-Queue-Type": queueClient.getCurrentQueueType(),
          "Cache-Control": "no-cache",
          "X-Presentation-ID": id,
          "X-User-ID": userId,
        },
      }
    );
    
    // for normal fetch
    const result = {
      data: agentResponse.data.slides || [],
      status: agentResponse.data.status || "N/A",
      title: agentResponse.data.title || "Generating...",
      total_slides: agentResponse.data.total_slide || 0,
      queueType: queueClient.getCurrentQueueType(),
      fetchedAt: new Date().toISOString(),
      presentationId: id,
      userId,
      source: "external_agent",
    };

    // const agentData = await fetch(`${agentBaseUrl}/slides/?p_id=${id}&t=${Date.now()}`, {
    //   method: "GET",
    //   headers: {
    //     "Content-Type": "application/json",
    //           "X-Queue-Type": queueClient.getCurrentQueueType(),
    //           "Cache-Control": "no-cache",
    //           "X-Presentation-ID": id,
    //           "X-User-ID": userId,
    //   },
    // });

    // const agentResponse = await agentData.json();

    // console.log(agentResponse, "agent response");

    // for normal fetch
    // const result = {
    //   data: agentResponse.slides || [],
    //   status: agentResponse.status || "N/A",
    //   title: agentResponse.title || "Generating...",
    //   total_slides: agentResponse.total_slide || 0,
    //   queueType: queueClient.getCurrentQueueType(),
    //   fetchedAt: new Date().toISOString(),
    //   presentationId: id,
    //   userId,
    //   source: "external_agent",
    // };

    broadcastPresentationUpdate(id, userId, {
      slides: result?.data,
      status: result?.status,
    });

    // Check if presentation is completed and queue for persistence
    if (result.status === "completed" || result.status === "done") {
      await queueCompletedPresentation(id, userId, result.status);
    }

    console.log(
      `[presentationService] Slides fetched for ${id} for user ${userId} using ${queueClient.getCurrentQueueType()}`
    );
    return result;
  } catch (error) {
    console.error("[presentationService] presentationSlides error:", error);
    throw new Error(
      `Failed to fetch presentation slides for ${id} for user ${userId}: ${error.message}`
    );
  }
};

const queueCompletedPresentation = async (presentationId, userId, status) => {
  try {
    // Check if already queued recently to avoid duplicates
    const queueKey = `queued_completion:${userId}:${presentationId}`;
    const alreadyQueued = await redis.get(queueKey);

    if (alreadyQueued) {
      console.log(
        `[presentationService] Presentation ${presentationId} already queued for completion`
      );
      return;
    }

    // Mark as queued with 10 minute expiration
    await redis.set(queueKey, Date.now(), "EX", 600);

    const completionPayload = {
      presentationId,
      userId,
      status,
      timestamp: new Date().toISOString(),
      queueType: queueClient.getCurrentQueueType(),
    };

    await queueClient.sendMessage("presentation_completed", completionPayload);

    console.log(
      `[presentationService] Queued completed presentation ${presentationId} for user ${userId}`
    );
  } catch (error) {
    console.error(
      "[presentationService] Error queueing completed presentation:",
      error
    );
  }
};

const clearPresentationCache = async (id, userId) => {
  try {
    const keysToDelete = [
      `logs:${userId}:${id}`,
      `slides:${userId}:${id}`,
      `presentation_metadata:${userId}:${id}`,
      `queued_completion:${userId}:${id}`,
    ];

    const pipeline = redis.pipeline();
    keysToDelete.forEach((key) => pipeline.del(key));
    await pipeline.exec();

    console.log(
      `[presentationService] Cleared cache for presentation ${id} for user ${userId}`
    );
  } catch (error) {
    console.error("[presentationService] Error clearing cache:", error);
  }
};

const getPresentationMetadata = async (id, userId) => {
  try {
    // First try to get from database
    const presentation = await Presentation.findByUserAndId(userId, id);

    if (presentation) {
      return {
        id: presentation.presentationId,
        userId: presentation.userId,
        status: presentation.status,
        message: presentation.message,
        title: presentation.title,
        totalSlides: presentation.totalSlides,
        queueType: presentation.queueType,
        currentQueueType: queueClient.getCurrentQueueType(),
        createdAt: presentation.createdAt.toISOString(),
        updatedAt: presentation.updatedAt.toISOString(),
        completedAt: presentation.completedAt?.toISOString(),
        savedAt: presentation.savedAt?.toISOString(),
        source: "database",
      };
    }

    // Fallback to Redis metadata
    const metadataKey = `presentation_metadata:${userId}:${id}`;
    const metadata = await redis.get(metadataKey);

    if (!metadata) {
      throw new Error(
        `Presentation metadata not found for ${id} for user ${userId}`
      );
    }

    const parsedMetadata = JSON.parse(metadata);
    parsedMetadata.currentQueueType = queueClient.getCurrentQueueType();
    parsedMetadata.source = "redis";

    return parsedMetadata;
  } catch (error) {
    console.error(
      "[presentationService] getPresentationMetadata error:",
      error
    );
    throw new Error(
      `Failed to get presentation metadata for ${id} for user ${userId}: ${error.message}`
    );
  }
};

const getUserPresentations = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;
    const presentations = await Presentation.findByUser(userId, limit, skip);

    const total = await Presentation.countDocuments({ userId });

    return {
      presentations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error("[presentationService] getUserPresentations error:", error);
    throw new Error(
      `Failed to get presentations for user ${userId}: ${error.message}`
    );
  }
};

const getQueueHealthStatus = () => {
  return {
    currentQueueType: queueClient.getCurrentQueueType(),
    isConnected: queueClient.isConnected(),
    rabbitmqConnected: queueClient.isRabbitMQConnected(),
    bullmqConnected: queueClient.isBullMQConnected(),
    timestamp: new Date().toISOString(),
  };
};

const setupPresentationTaskConsumer = async (callback) => {
  try {
    console.log(
      `[presentationService] Setting up presentation task consumer using ${queueClient.getCurrentQueueType()}`
    );

    await queueClient.consumeMessages(
      "presentation_tasks",
      async (messageContent) => {
        try {
          const taskData = JSON.parse(messageContent);
          console.log(
            `[presentationService] Processing presentation task: ${taskData.presentationId} for user ${taskData.userId}`
          );

          // Update database status
          const presentation = await Presentation.findByUserAndId(
            taskData.userId,
            taskData.presentationId
          );

          if (presentation) {
            presentation.status = "processing";
            presentation.agentMetadata = {
              ...presentation.agentMetadata,
              processedAt: new Date(),
              processedBy: queueClient.getCurrentQueueType(),
            };
            await presentation.save();
          }

          // Update Redis metadata for backward compatibility
          const metadataKey = `presentation_metadata:${taskData.userId}:${taskData.presentationId}`;
          const existingMetadata = await redis.get(metadataKey);

          if (existingMetadata) {
            const parsedMetadata = JSON.parse(existingMetadata);
            parsedMetadata.status = "processing";
            parsedMetadata.processedAt = new Date().toISOString();
            parsedMetadata.processedBy = queueClient.getCurrentQueueType();

            await redis.set(
              metadataKey,
              JSON.stringify(parsedMetadata),
              "EX",
              86400
            );
          }

          if (callback && typeof callback === "function") {
            await callback(taskData);
          }

          console.log(
            `[presentationService] Successfully processed presentation task: ${taskData.presentationId} for user ${taskData.userId}`
          );
        } catch (error) {
          console.error(
            "[presentationService] Error processing presentation task:",
            error
          );
          throw error;
        }
      }
    );

    console.log(
      `[presentationService] Presentation task consumer setup completed using ${queueClient.getCurrentQueueType()}`
    );
  } catch (error) {
    console.error(
      "[presentationService] Failed to setup presentation task consumer:",
      error
    );
    throw error;
  }
};

// FOR CHAT MESSAGE HANDLING
const processChatMessage = async (presentationId, userId, message) => {
  try {
    // 1. Find the presentation and update chat history
    const presentation = await Presentation.findByUserAndId(
      userId,
      presentationId
    );
    if (!presentation) {
      console.log("[PROCESSchatMessages] presentation data", presentation);
      throw new Error(
        `Presentation ${presentationId} not found for user ${userId}`
      );
    }

    presentation.chatHistory.push({ role: "user", content: message });
    await presentation.save();

    // 2. Broadcast the user's message immediately for a snappy UI
    broadcastPresentationUpdate(presentationId, userId, {
      newChatMessage: { role: "user", content: message, timestamp: new Date() },
    });

    // 3. Create a task payload for the agent
    const taskPayload = {
      presentationId,
      userId,
      message,
      // Pass the entire context so the agent doesn't have to re-fetch
      context: {
        slides: presentation.slides,
        chatHistory: presentation.chatHistory,
      },
      taskType: "chat_interaction", // Differentiate from 'initial_creation'
      timestamp: new Date().toISOString(),
      queueType: queueClient.getCurrentQueueType(),
    };

    // 4. Send to the same queue, or a dedicated "interaction" queue
    await queueClient.sendMessage("presentation_tasks", taskPayload);

    console.log(
      `[presentationService] Queued chat interaction for ${presentationId}`
    );

    return {
      taskId: `${presentationId}-${Date.now()}`, // Return some identifier
    };
  } catch (error) {
    console.error(
      `[presentationService] processChatMessage error for ${presentationId}:`,
      error
    );
    throw error;
  }
};

const postMessage = async (presentationId, user_query, userId) => {
  try {
    //  await axios.post(`${agentBaseUrl}/edit-slide`, {
    //   p_id: presentationId,
    //   user_id: userId,
    //   session_id: presentationId,
    //   user_query: user_query,
    // }, {timeout: 3600000});   
    
    const result = await fetch(`${agentBaseUrl}/create-presentation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Queue-Type": "bullmq",
        "X-Presentation-ID": presentationId,
        "X-User-ID": userId,
      },
      body: JSON.stringify({
        p_id: presentationId,
        userId: userId,
        // session_id: presentationId,
        message: user_query,
        // file_urls: []
      }),
    });

    console.log(result, "from post message");

    console.log(userId, "userId", typeof userId);

    broadcastPresentationUpdate(presentationId, userId, {
      status: "processing",
    });

    return {
      message: "Process started successfully"
    }

  } catch (error) {
    console.log(
      `[presentationService] postMesasge error for ${presentationId}:`,
      error
    );
    throw error;
  }
}

const PresentationService = {
  getAllPresentationSlides,
  initiatePresentation,
  presentationLogs,
  presentationSlides,
  getPresentationMetadata,
  getUserPresentations,
  getQueueHealthStatus,
  setupPresentationTaskConsumer,
  clearPresentationCache,
  queueClient,
  QUEUE_TYPES,
  processChatMessage,
  postMessage,
};

module.exports = PresentationService;
