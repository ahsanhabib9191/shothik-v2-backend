const axios = require('axios');
const { redis } = require('../lib/Redis');
// const EventSource = require('eventsource'); // For SSE client
const SheetAiChats = require('../mongo/models/SheetAiChatSchema');
const SheetAiConversations = require('../mongo/models/SheetAiConversationsSchema');
const axiosRetry = require("axios-retry").default;

axiosRetry(axios, {
  retries: 10,
  retryDelay: () => 3000,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});

class SheetAiService { 
  constructor() {
    this.externalSheetApiURL =
      process.env.SHEET_SERVICE_API_URL || "https://sheetai.pixigenai.com/api";
    this.adminEmail = process.env.SHEET_AI_ADMIN_EMAIL;
    this.adminPassword = process.env.SHEET_AI_ADMIN_PASSWORD;

    // Initialize Redis client
    this.redisClient = redis;

    // Active SSE connections tracker
    this.activeConnections = new Map();

    // Connection cleanup interval
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 60000);
  }

  /*
  * For both register and login service
  */

  async registerSheetService(email, name, password = this.adminPassword)  {
    // console.log(email, "parameters email of sheet service");
    try {
      const cacheKey = `sheetai:token:${email}`;

      const cachedToken = await this.redisClient.get(cacheKey);

      
      if(cachedToken) {
        const tokenData = JSON.parse(cachedToken);
        
        // Check is token is still valid (not expected)
        if(tokenData.expiresAt > Date.now()) {
          console.log(cachedToken, "cached token");
          // return tokenData.token;
          return {
            success: true,
            token: tokenData.token,
            status: "success",  
          };
        }
      }

      // Token not found or expired, need to login
      const loginResult = await this.loginToSheetAi(email, password);
      
      if(!loginResult.success) {
        // if logged in failed try to register for new user
        try {
          const registerResult = await this.registerToSheetAi(name || 'default', email, password);
          
          if(registerResult.success) {
            // If user is registered successfully try to login again for new user
            const loginResult =await this.loginToSheetAi(email, password);

            // console.log(loginResult, "login result of sheet after register");
            
            if(loginResult.success) {
              const token = loginResult.token;

              // store token in Redis with TTL (assuming 30 days)
              const expiresAt = Date.now() + 3 * 60 * 1000; // for test 3 minutes

              await this.redisClient.set(cacheKey, JSON.stringify({
                token,
                expiresAt,
              }), 3 * 60 * 1000);
            return {
              success: true,
              // data: loginResult?.data,
              token: loginResult?.data.access_token,
              status: loginResult?.status,
            };
            }
          }
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.message || error.message,
            status: error.response?.status || 500,
          };
        }
        // ======
      }

      // console.log(loginResult, "from sheet ai service");

      // for login Successfull
      const token = loginResult.token;

      // store token in Redis with TTL (assuming 30 days)
      const expiresAt = Date.now() + 3 * 60 * 1000; // for test 3 minutes

      await this.redisClient.set(
        cacheKey,
        JSON.stringify({
          token,
          expiresAt,
        }),
        3 * 60 * 1000
      );

    // console.log(loginResult, "loginResult");

    return {
      success: true,
      // data: loginResult?.data,
      token: loginResult?.data.access_token,
      status: loginResult?.status,
    };
    } catch (error) {
      console.error(
        "Sheet AI Registration Error:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status || 500,
      };
    }
  }

  /**
   * Register a user to Sheet AI API
   */
  async registerToSheetAi(name = 'default', email, password = this.adminPassword) {
    console.log(email, "email");
    try {
      const response = await axios.post(
        `${this.externalSheetApiURL}/auth/register_user`,
        {
          name,
          email,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 20000,
        }
      );

      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      console.error(
        "Sheet AI Registration Error:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status || 500,
      };
    }
  }

  /**
   * Login to Sheet AI API
   */
  async loginToSheetAi(email, password = this.adminPassword) {
    console.log(email, "user email form login sheet AI")
    try {
      const response = await axios.post(
        `${this.externalSheetApiURL}/auth/login`,
        {
          email,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // console.log(response.data, "response");

      return {
        success: true,
        data: response.data,
        token: response.data.access_token,
        status: response.status,
      };
    } catch (error) {
      console.error(
        "Sheet AI Login Error:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status || 500,
      };
    }
  }

  /**
   * Get valid token for a user (from cache or by login)
   */
  async getValidToken(userId, userEmail, defaultPassword) {
    try {
      const cacheKey = `sheetai:token:${userId}`;

      // Check Redis cache first
      const cachedToken = await this.redisClient.get(cacheKey);

      console.log(cachedToken, "cached token");

      if (cachedToken) {
        const tokenData = JSON.parse(cachedToken);

        // Check if token is still valid (not expired)
        if (tokenData.expiresAt > Date.now()) {
          return tokenData.token;
        }
      }

      // Token not found or expired, need to login
      const loginResult = await this.loginToSheetAi(userEmail, defaultPassword);

      if (!loginResult.success) {
        throw new Error(`Failed to get Sheet AI token: ${loginResult.error}`);
      }

      const token = loginResult.token;
      console.log(loginResult, "get valid token result");

      // Store token in Redis with TTL (assuming 30 days expiry)
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await this.redisClient.set(
        cacheKey,
        JSON.stringify({
          token,
          expiresAt,
        }),
        30 * 24 * 60 * 60
      );

      return token;
    } catch (error) {
      console.error("Error getting valid token:", error);
      throw error;
    }
  }

  /**
   * Create a new chat
   */
  async createChat(
    userId,
    name,
    userEmail,
    defaultPassword = this.adminPassword,
    sheetAiToken
  ) {
    try {
      const token = await this.getValidToken(
        userId,
        userEmail,
        defaultPassword
      );

      // console.log(token, "create chat token");

      const response = await axios.post(
        `${this.externalSheetApiURL}/chat/create_chat`,
        {
          name,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      // Store chat in our database
      const chat = new SheetAiChats({
        userId,
        sheetAiChatId: response.data._id || response.data.id,
        name,
      });

      await chat.save();

      // Clear cache for user's chats
      await this.redisClient.remove(`sheetai:chats:${userId}`);

      return {
        success: true,
        data: {
          ...response.data,
          localChatId: chat._id,
        },
        status: response.status,
      };
    } catch (error) {
      console.error(
        "Error creating chat:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status || 500,
      };
    }
  }

  /**
   * Get user's chats
   */
  async getMyChats(userId, userEmail, defaultPassword = this.adminPassword) {
    try {
      const cacheKey = `sheetai:chats:${userId}`;

      // Check cache first
      const cachedChats = await this.redisClient.get(cacheKey);
      if (cachedChats) {
        return {
          success: true,
          data: JSON.parse(cachedChats),
          fromCache: true,
        };
      }

      const token = await this.getValidToken(
        userId,
        userEmail,
        defaultPassword
      );

      const response = await axios.get(
        `${this.externalSheetApiURL}/chat/get_my_chats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      // Merge with local database data
      const localChats = await SheetAiChats.find({ userId }).sort({
        createdAt: -1,
      });

      const mergedChats = response.data.map((externalChat) => {
        const localChat = localChats.find(
          (local) =>
            local.sheetAiChatId === (externalChat._id || externalChat.id)
        );

        return {
          ...externalChat,
          localChatId: localChat?._id,
          localName: localChat?.name,
        };
      });

      // Cache for 5 minutes
      await this.redisClient.set(cacheKey, JSON.stringify(mergedChats), 300);

      return {
        success: true,
        data: mergedChats,
        status: response.status,
      };
    } catch (error) {
      console.error(
        "Error getting chats:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
        status: error.response?.status || 500,
      };
    }
  }

  /**
   * Create a conversation with SSE streaming support
   */
  async createConversationWithStreaming(
    userId,
    chatId,
    prompt,
    userEmail,
    responseStream,
    defaultPassword = this.adminPassword
  ) {
    let conversationRecord = null;
    let sheetAiConversationId = null;

    try {
      // Get the Sheet AI chat ID from local database
      const localChat = await SheetAiChats.findOne({ _id: chatId, userId });
      if (!localChat) {
        throw new Error("Chat not found");
      }

      // Create conversation record with pending status
      conversationRecord = new SheetAiConversations({
        userId,
        chatId,
        sheetAiConversationId: null,
        prompt,
        response: { status: "streaming" },
        status: "pending",
      });

      await conversationRecord.save();

      const token = await this.getValidToken(
        userId,
        userEmail,
        defaultPassword
      );

    //   console.log(localChat, "localChat");

    //   Make the API call that returns newline-delimited JSON stream
      const response = await axios.post(
        `${this.externalSheetApiURL}/conversation/create_conversation`,
        {
          chat: localChat.sheetAiChatId,
          prompt,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream", // Keep this if the API expects it
          },
          responseType: "stream",
          adapter: "fetch",
        }
      );

      console.log(response.data);

      const chunks = [];
      for await (const chunk of response.data) {
        chunks.push(chunk);
      }

      const fullRaw = Buffer.concat(chunks).toString();

      // Split the data using the delimiter `} data` and re-add closing brace to each JSON
      const jsonBlocks = fullRaw
        .split("} data")
        .filter((block) => block.trim())
        .map((block) => {
          const cleaned = block.trim();
          return cleaned.endsWith("}") ? cleaned : cleaned + "}";
        });

      let finalResponse = null;
      let sheetAiConversationId = null;
      let isCompleted = false;

      for (const raw of jsonBlocks) {
        try {
          const jsonData = JSON.parse(raw);

          const step = jsonData.step;
          const message = jsonData.data?.message;

          // Simulate delay (optional for UX)
          await new Promise((r) => setTimeout(r, 400));

          if (step === "completed") {
            finalResponse = jsonData.data.response;
            sheetAiConversationId = jsonData.data._id;
            isCompleted = true;

            responseStream.write(
              `data: ${JSON.stringify({
                type: "content",
                content: finalResponse,
                conversationId: sheetAiConversationId,
                localConversationId: conversationRecord._id,
                timestamp: Date.now(),
              })}\n\n`
            );

            responseStream.write(
              `data: ${JSON.stringify({
                type: "completion",
                conversationId: conversationRecord._id,
                status: "completed",
              })}\n\n`
            );
            responseStream.end();
          } else {
            // Send progress update
            responseStream.write(
              `data: ${JSON.stringify({
                type: "progress",
                step,
                message,
                conversationId: conversationRecord._id,
                timestamp: Date.now(),
              })}\n\n`
            );
          }
        } catch (err) {
          console.warn("Failed to parse simulated chunk:", raw);
          responseStream.write(
            `data: ${JSON.stringify({
              type: "error",
              error: "Failed to parse stream chunk",
            })}\n\n`
          );
        }
      }

      // Update DB
      await SheetAiConversations.findByIdAndUpdate(conversationRecord._id, {
        sheetAiConversationId,
        response: finalResponse || {
          status: isCompleted ? "completed" : "partial",
          content: finalResponse,
        },
        status: isCompleted ? "completed" : "partial",
      });

      // Clear Redis cache
      await this.redisClient.remove(`sheetai:conversations:${chatId}`);

      if (!isCompleted) {
        responseStream.write(
          `data: ${JSON.stringify({
            type: "completion",
            conversationId: conversationRecord._id,
            status: "completed",
          })}\n\n`
        );
        responseStream.end();
      }      

    //   Handle newline-delimited JSON stream
    //   let accumulatedData = "";
    //   let isCompleted = false;
    //   let finalResponse = null;

    //   let buffer = "";

    //   response.data.on("data", (chunk) => {
    //     try {
    //       // Accumulate chunks
    //       buffer += chunk.toString();

    //       // Process complete lines (newline-delimited JSON)
    //       const lines = buffer.split("\n");
    //       // Keep the last potentially incomplete line in buffer
    //       buffer = lines.pop() || "";

    //       // Process each complete line
    //       for (const line of lines) {
    //         const trimmedLine = line.trim();
    //         if (!trimmedLine) continue; // Skip empty lines

    //         try {
    //           const jsonData = JSON.parse(trimmedLine);

    //           console.log(jsonData, "jsonData from streaming");

    //           // Handle different steps in the process
    //           switch (jsonData.step) {
    //             case "validation":
    //               responseStream.write(
    //                 `data: ${JSON.stringify({
    //                   type: "progress",
    //                   step: "validation",
    //                   message: "Validating request...",
    //                   conversationId: conversationRecord._id,
    //                   timestamp: Date.now(),
    //                 })}\n\n`
    //               );
    //               break;

    //             case "database_create":
    //               responseStream.write(
    //                 `data: ${JSON.stringify({
    //                   type: "progress",
    //                   step: "database_create",
    //                   message: "Creating conversation record...",
    //                   conversationId: conversationRecord._id,
    //                   timestamp: Date.now(),
    //                 })}\n\n`
    //               );
    //               break;

    //             case "llm_processing":
    //               responseStream.write(
    //                 `data: ${JSON.stringify({
    //                   type: "progress",
    //                   step: "llm_processing",
    //                   message: "Processing with AI model...",
    //                   conversationId: conversationRecord._id,
    //                   timestamp: Date.now(),
    //                 })}\n\n`
    //               );
    //               break;

    //             case "formatting":
    //               responseStream.write(
    //                 `data: ${JSON.stringify({
    //                   type: "progress",
    //                   step: "formatting",
    //                   message: "Formatting AI response...",
    //                   conversationId: conversationRecord._id,
    //                   timestamp: Date.now(),
    //                 })}\n\n`
    //               );
    //               break;

    //             case "memory_storage":
    //               responseStream.write(
    //                 `data: ${JSON.stringify({
    //                   type: "progress",
    //                   step: "memory_storage",
    //                   message: "Storing conversation in memory...",
    //                   conversationId: conversationRecord._id,
    //                   timestamp: Date.now(),
    //                 })}\n\n`
    //               );
    //               break;

    //             case "database_update":
    //               responseStream.write(
    //                 `data: ${JSON.stringify({
    //                   type: "progress",
    //                   step: "database_update",
    //                   message: "Updating conversation with response...",
    //                   conversationId: conversationRecord._id,
    //                   timestamp: Date.now(),
    //                 })}\n\n`
    //               );
    //               break;

    //             case "completed":
    //               // This contains the final response with the actual data
    //               if (jsonData.data && jsonData.data._id) {
    //                 sheetAiConversationId = jsonData.data._id;
    //                 finalResponse = jsonData.data.response;

    //                 // Send the complete response to client
    //                 responseStream.write(
    //                   `data: ${JSON.stringify({
    //                     type: "content",
    //                     content: finalResponse,
    //                     conversationId: sheetAiConversationId,
    //                     localConversationId: conversationRecord._id,
    //                     timestamp: Date.now(),
    //                   })}\n\n`
    //                 );

    //                 // Mark as completed
    //                 isCompleted = true;
    //                 responseStream.write(
    //                   `data: ${JSON.stringify({
    //                     type: "completion",
    //                     conversationId: conversationRecord._id,
    //                     status: "completed",
    //                   })}\n\n`
    //                 );
    //                 responseStream.end();
    //               }
    //               break;

    //             default:
    //               // Handle any other steps or unknown formats
    //               console.log("Unknown step:", jsonData.step);
    //               break;
    //           }
    //         } catch (parseError) {
    //           console.error(
    //             "Error parsing JSON line:",
    //             parseError,
    //             "Line:",
    //             trimmedLine
    //           );
    //         }
    //       }
    //     } catch (error) {
    //       console.error("Error processing response chunk:", error);
    //       responseStream.write(
    //         `data: ${JSON.stringify({
    //           type: "error",
    //           error: "Response processing error",
    //         })}\n\n`
    //       );
    //       responseStream.end();
    //     }
    //   });

    //   response.data.on("end", async () => {
    //     try {
    //       // Process any remaining data in buffer
    //       if (buffer.trim()) {
    //         try {
    //           const jsonData = JSON.parse(buffer.trim());
    //           if (jsonData.step === "completed" && jsonData.data) {
    //             sheetAiConversationId = jsonData.data._id;
    //             finalResponse = jsonData.data.response;
    //           }
    //         } catch (parseError) {
    //           console.error("Error parsing final buffer:", parseError);
    //         }
    //       }

    //       // Update conversation record with final data
    //       const updateData = {
    //         sheetAiConversationId: sheetAiConversationId,
    //         response: finalResponse || {
    //           content: accumulatedData,
    //           status: isCompleted ? "completed" : "partial",
    //         },
    //         status: isCompleted ? "completed" : "partial",
    //       };

    //       await SheetAiConversations.findByIdAndUpdate(
    //         conversationRecord._id,
    //         updateData
    //       );

    //       // Clear cache
    //       await this.redisClient.remove(`sheetai:conversations:${chatId}`);

    //       if (!isCompleted) {
    //         responseStream.write(
    //           `data: ${JSON.stringify({
    //             type: "completion",
    //             conversationId: conversationRecord._id,
    //             status: "completed",
    //           })}\n\n`
    //         );
    //         responseStream.end();
    //       }
    //     } catch (error) {
    //       console.error("Error finalizing conversation:", error);
    //       responseStream.write(
    //         `data: ${JSON.stringify({
    //           type: "error",
    //           error: "Finalization error",
    //         })}\n\n`
    //       );
    //       responseStream.end();
    //     }
    //   });

    //   response.data.on("error", async (error) => {
    //     console.error("SSE stream error:", error);

    //     try {
    //       // Update conversation as failed
    //       await SheetAiConversations.findByIdAndUpdate(conversationRecord._id, {
    //         response: { error: error.message },
    //         status: "failed",
    //       });
    //     } catch (dbError) {
    //       console.error("Error updating failed conversation:", dbError);
    //     }

    //     responseStream.write(
    //       `data: ${JSON.stringify({
    //         type: "error",
    //         error: error.message,
    //       })}\n\n`
    //     );
    //     responseStream.end();
    //   });

      return {
        success: true,
        conversationId: conversationRecord._id,
        message: "Streaming started",
      };
    } catch (error) {
      console.error("Error creating conversation with streaming:", error);

      // Update conversation as failed if it was created
      if (conversationRecord) {
        try {
          await SheetAiConversations.findByIdAndUpdate(conversationRecord._id, {
            response: { error: error.message },
            status: "failed",
          });
        } catch (dbError) {
          console.error("Error updating failed conversation:", dbError);
        }
      }

      responseStream.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error.message,
        })}\n\n`
      );
      responseStream.end();

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get conversations for a chat
   */
  async getChatConversations(
    userId,
    chatId,
    userEmail,
    defaultPassword = this.adminPassword
  ) {
    try {
      const cacheKey = `sheetai:conversations:${chatId}`;

      // Check cache first
      const cachedConversations = await this.redisClient.get(cacheKey);
      if (cachedConversations) {
        return {
          success: true,
          data: JSON.parse(cachedConversations),
          fromCache: true,
        };
      }

      // Get conversations from local database
      const localConversations = await SheetAiConversations.find({
        userId,
        chatId,
      }).sort({ createdAt: -1 });

      const conversationsData = localConversations.map((conv) => ({
        _id: conv._id,
        sheetAiConversationId: conv.sheetAiConversationId,
        prompt: conv.prompt,
        response: conv.response,
        status: conv.status,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }));

      // Cache for 2 minutes
      await this.redisClient.set(
        cacheKey,
        JSON.stringify(conversationsData),
        120
      );

      return {
        success: true,
        data: conversationsData,
        status: 200,
      };
    } catch (error) {
      console.error("Error getting conversations:", error);

      return {
        success: false,
        error: error.message,
        status: 500,
      };
    }
  }

  /**
   * Delete a chat
   */
  async deleteChat(userId, chatId) {
    try {
      // Delete from local database
      const deletedChat = await SheetAiChats.findOneAndDelete({
        _id: chatId,
        userId,
      });

      if (!deletedChat) {
        return {
          success: false,
          error: "Chat not found",
          status: 404,
        };
      }

      // Delete associated conversations
      await SheetAiConversations.deleteMany({ chatId, userId });

      // Clear caches
      await this.redisClient.remove(`sheetai:chats:${userId}`);
      await this.redisClient.remove(`sheetai:conversations:${chatId}`);

      return {
        success: true,
        data: { message: "Chat deleted successfully" },
        status: 200,
      };
    } catch (error) {
      console.error("Error deleting chat:", error);

      return {
        success: false,
        error: error.message,
        status: 500,
      };
    }
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [key, connectionInfo] of this.activeConnections.entries()) {
      if (now - connectionInfo.lastActivity > timeout) {
        try {
          connectionInfo.stream?.end();
        } catch (error) {
          console.error("Error cleaning up connection:", error);
        }
        this.activeConnections.delete(key);
      }
    }
  }

  /**
   * Clear user's token cache
   */
  async clearUserTokenCache(userId) {
    try {
      await this.redisClient.remove(`sheetai:token:${userId}`);
    } catch (error) {
      console.error("Error clearing token cache:", error);
    }
  }

  /**
   * Health check for Sheet AI service
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.externalSheetApiURL}/health`, {
        timeout: 5000,
      });

      return {
        success: true,
        status: "healthy",
        responseTime: response.headers["x-response-time"] || "N/A",
        activeConnections: this.activeConnections.size,
      };
    } catch (error) {
      return {
        success: false,
        status: "unhealthy",
        error: error.message,
        activeConnections: this.activeConnections.size,
      };
    }
  }
}

module.exports = SheetAiService;