// workers/presentationPersistenceWorker.js
const { queueClient } = require("../config/queueClient");
const { broadcastPresentationUpdate } = require("../config/socket");
const Presentation = require("../mongo/models/PresentaionSchema");
const axios = require("axios");
const axiosRetry = require("axios-retry").default;


axiosRetry(axios, {
  retries: 10,
  retryDelay: () => 3000, // 3 seconds
  retryCondition: (error) => {
    // Retry on network errors or 5xx responses
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});

class PresentationPersistenceWorker {
  constructor() {
    this.isRunning = false;
    this.agentBaseUrl = process.env.PRESENTATION_AGENT_BASE_URL;
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async start() {
    if (this.isRunning) {
      console.log("[PersistenceWorker] Worker already running");
      return;
    }

    this.isRunning = true;
    console.log(
      "[PersistenceWorker] Starting presentation persistence worker..."
    );

    try {
      
      await queueClient.consumeMessages(
        "presentation_completed",
        this.handleCompletedPresentation.bind(this)
      );

      this.startPeriodicCheck();

      console.log(
        "[PersistenceWorker] Presentation persistence worker started successfully"
      );
    } catch (error) {
      console.error("[PersistenceWorker] Failed to start worker:", error);
      this.isRunning = false;
      throw error;
    }
  }

  
  async healthCheck() {
    return this.isRunning && queueClient.isConnected();
  }

  async handleCompletedPresentation(messageContent) {
    try {
      const taskData = JSON.parse(messageContent);
      const { presentationId, userId, status } = taskData;

      console.log(
        `[PersistenceWorker] Processing completed presentation: ${presentationId} for user ${userId}`
      );

      // Fetch final data from external agent
      const [logsData, slidesData] = await Promise.all([
        this.fetchFinalLogs(presentationId, userId),
        this.fetchFinalSlides(presentationId, userId),
      ]);

      // Save to database
      await this.saveToDatabase(presentationId, userId, logsData, slidesData);

      // Broadcast update to connected clients
      broadcastPresentationUpdate(presentationId, userId, {
        status: "saved",
        logs: logsData.data,
        slides: slidesData.data,
        title: slidesData.title,
        totalSlides: slidesData.total_slides,
      });

      console.log(
        `[PersistenceWorker] Successfully processed presentation ${presentationId} for user ${userId}`
      );
    } catch (error) {
      console.error(
        "[PersistenceWorker] Error processing completed presentation:",
        error
      );

      // Retry logic
      await this.retryWithBackoff(messageContent, error);
    }
  }

  async fetchFinalLogs(presentationId, userId) {
    try {
      const response = await axios.get(
        `${this.agentBaseUrl}/logs/?p_id=${presentationId}&final=true`,
        {
          timeout: 3600000, // 1 hour in milliseconds
          headers: {
            "Content-Type": "application/json",
            "X-Queue-Type": queueClient.getCurrentQueueType(),
            "X-Presentation-ID": presentationId,
            "X-User-ID": userId,
          },
        }
      );

      // await fetch(
      //   `${this.agentBaseUrl}/logs/?p_id=${presentationId}&final=true`,
      //   {
      //     method: "GET",
      //     headers: {
      //       "Content-Type": "application/json",
      //       "X-Queue-Type": queueClient.getCurrentQueueType(),
      //       "X-Presentation-ID": presentationId,
      //       "X-User-ID": userId,
      //     },
      //   }
      // );

      return {
        data: response.data?.logs || [],
        status: response.data?.status || "completed",
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `[PersistenceWorker] Failed to fetch final logs for ${presentationId}:`,
        error.message
      );
      throw error;
    }
  }

  async fetchFinalSlides(presentationId, userId) {
    try {
      const response = await axios.get(
        `${this.agentBaseUrl}/slides/?p_id=${presentationId}&final=true`,
        {
          timeout: 3600000, // 1 hour in milliseconds
          headers: {
            "Content-Type": "application/json",
            "X-Queue-Type": queueClient.getCurrentQueueType(),
            "X-Presentation-ID": presentationId,
            "X-User-ID": userId,
          },
        }
      );

      // await fetch(
      //   `${this.agentBaseUrl}/slides/?p_id=${presentationId}&final=true`,
      //   {
      //         headers: {
      //           "Content-Type": "application/json",
      //           "X-Queue-Type": queueClient.getCurrentQueueType(),
      //           "X-Presentation-ID": presentationId,
      //           "X-User-ID": userId,
      //         },
      //       }
      // );

      return {
        data: response.data?.slides || [],
        status: response.data?.status || "completed",
        title: response.data?.title || "Untitled Presentation",
        total_slides: response.data?.total_slide || 0,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `[PersistenceWorker] Failed to fetch final slides for ${presentationId}:`,
        error.message
      );
      throw error;
    }
  }

  async saveToDatabase(presentationId, userId, logsData, slidesData) {
    try {
      // Find existing presentation or create new one
      let presentation = await Presentation.findByUserAndId(
        userId,
        presentationId
      );

      if (!presentation) {
        // Create new presentation record if it doesn't exist
        presentation = new Presentation({
          presentationId,
          userId,
          title: slidesData.title,
          message: "Restored from external agent", // Fallback message
          status: "completed",
          queueType: queueClient.getCurrentQueueType(),
        });
      }

      // Update presentation with final data
      presentation.title = slidesData.title;
      presentation.totalSlides = slidesData.total_slides;
      presentation.status = "saved";
      presentation.completedAt = new Date();
      presentation.savedAt = new Date();

      presentation.logs = logsData.data.map((log) => ({
        timestamp: new Date(log.timestamp || Date.now()),
        agent_name: log.agent_name || "unknown_agent",
        parsed_output: log.parsed_output, // Mongoose `Mixed` type handles objects and strings
      }));

      presentation.slides = slidesData.data.map((slide) => ({
        slide_index: slide.slide_index,
        thought: slide.thought || "",
        body: slide.body || "<!-- No slide content available -->",
      }));

      // Set agent metadata
      presentation.agentMetadata = {
        processedAt: new Date(),
        processedBy: queueClient.getCurrentQueueType(),
        processingDuration: null, // Could be calculated if timestamps are available
        agentVersion: "1.0", // Could be dynamic
      };

      await presentation.save();

      console.log(
        `[PersistenceWorker] Successfully saved presentation ${presentationId} to database`
      );

      return presentation;
    } catch (error) {
      console.error(
        `[PersistenceWorker] Failed to save presentation ${presentationId} to database:`,
        error
      );
      throw error;
    }
  }

  async retryWithBackoff(messageContent, error) {
    const taskData = JSON.parse(messageContent);
    const retryCount = taskData.retryCount || 0;

    if (retryCount < this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, retryCount);
      console.log(
        `[PersistenceWorker] Retrying in ${delay}ms (attempt ${
          retryCount + 1
        }/${this.maxRetries})`
      );

      setTimeout(async () => {
        taskData.retryCount = retryCount + 1;
        await queueClient.sendMessage("presentation_completed", taskData);
      }, delay);
    } else {
      console.error(
        `[PersistenceWorker] Max retries reached for presentation ${taskData.presentationId}`
      );

      // Mark as failed in database
      try {
        const presentation = await Presentation.findByUserAndId(
          taskData.userId,
          taskData.presentationId
        );
        if (presentation) {
          presentation.status = "failed";
          presentation.agentMetadata = {
            ...presentation.agentMetadata,
            error: error.message,
            failedAt: new Date(),
          };
          await presentation.save();
        }
      } catch (dbError) {
        console.error(
          "[PersistenceWorker] Failed to mark presentation as failed:",
          dbError
        );
      }
    }
  }

  startPeriodicCheck() {
    // Check every 5 minutes for presentations that might have been missed
    setInterval(async () => {
      try {
        await this.checkForMissedPresentations();
      } catch (error) {
        console.error("[PersistenceWorker] Error in periodic check:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async checkForMissedPresentations() {
    try {
      // Find presentations that are marked as completed but not saved
      const missedPresentations = await Presentation.findPendingSaves(10);

      if (missedPresentations.length > 0) {
        console.log(
          `[PersistenceWorker] Found ${missedPresentations.length} missed presentations`
        );

        for (const presentation of missedPresentations) {
          await queueClient.sendMessage("presentation_completed", {
            presentationId: presentation.presentationId,
            userId: presentation.userId,
            status: "completed",
            source: "periodic_check",
          });
        }
      }
    } catch (error) {
      console.error(
        "[PersistenceWorker] Error checking for missed presentations:",
        error
      );
    }
  }

  async stop() {
    console.log(
      "[PersistenceWorker] Stopping presentation persistence worker..."
    );
    this.isRunning = false;
  }
}

module.exports = PresentationPersistenceWorker;
