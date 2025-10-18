const rateLimit = require("express-rate-limit");

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Maximum 100 requests per windowMs
  skipSuccessfulRequests: false, // Count all requests, including successful ones
  handler: (req, res, next) => {
    // Handle rate limit exceeded error
    next({
      success: false,
      status: 429,
      message: "Too many requests, please try again later.",
    });
  },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  skipSuccessfulRequests: false,
  handler: (req, res, next) => {
    next({
      success: false,
      status: 429,
      message: "Too many requests, please try again later.",
    });
  },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  handler: (req, res, next) => {
    next({
      success: false,
      status: 429,
      message: "Too many requests, please try again later.",
    });
  },
});

module.exports = {
  globalLimiter,
  paymentLimiter,
  authLimiter,
};
