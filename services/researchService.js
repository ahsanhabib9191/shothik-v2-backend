const axios = require("axios");

const axiosRetry = require("axios-retry").default;
const { redis } = require("../lib/Redis");

axiosRetry(axios, {
  retries: 10,
  retryDelay: () => 3000,
  retryCondition: (error) => {
    return axiosRetry.isIdempotentRequestError(error);
  },
});

class ResearchAiService {
  constructor() {
    this.externalResearchApiURL = process.env.RESEARCH_SERVICE_API_URL || "";
    this.adminEmail = process.env.SHEET_AI_ADMIN_EMAIL;
    this.adminPassword = process.env.SHEET_AI_ADMIN_PASSWORD;

    // Initialize Redis client
    this.redisClient = redis;
  }

  /*
   * For both register and login service
   */

  async registerResearchService(email, password = this.adminPassword) {
    try {
      const cacheKey = `research:token:${email}`;

      const cachedToken = await this.redisClient.get(cacheKey);

      if (cachedToken) {
        const tokenData = JSON.parse(cachedToken);

        // check is token is still valid (not expected)
        if (tokenData.expiresAt > Date.now()) {
          // console.log(cachedToken, "cached token");
          // return tokenData.token;
          return {
            success: true,
            token: tokenData.token,
            status: "success",
          };
        }
      }

      //   Token not found or expired, need to login
      const loginResult = await this.loginToResearchAi(email, password);

      if (!loginResult.success) {
        // if logged in failed try to register for new user
        try {
          const registerResult = await this.registerToResearchAi(
            'default',
            email,
            password
          );

          if (registerResult.success) {
            // If user is registered successfully try to login again for new user
            const loginResult = await this.loginToResearchAi(email, password);

            if (loginResult.success) {
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
        "Research AI registration Error:",
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
     * Register a user to Research AI API
     */
    async registerToResearchAi(name = 'default', email, password = this.adminPassword) {
      try {
        const response = await axios.post(
          `${this.externalResearchApiURL}/api/auth/register_user`,
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
          "Research AI Registration Error:",
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
   * loginToResearch AI API
   */

  async loginToResearchAi(email, password = this.adminPassword) {
    try {
      const response = await axios.post(
        `${this.externalResearchApiURL}/api/auth/login`,
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

      console.log(response.data, "response login");

      return {
        success: true,
        data: response.data,
        token: response.data.access_token,
        status: response.status,
      };
    } catch (error) {
      console.error(
        "Research AI Login Error:",
        error.response?.data || error.message
      );

      if (error.response?.data?.status === 404) {
        await this.regis
      }
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          status: error.response?.status || 500,
        };
    }
  }
}

module.exports = ResearchAiService;
