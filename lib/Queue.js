const Queue = require("bull");
const { default: Redlock } = require("redlock");
const { Transection } = require("../mongo/models/UserTransection");
const { User } = require("@ridz-shothikai/shothik-auth-service/src/models/User");
const { redis } = require("./Redis");
const { redisConfig } = require("./Redis");

// Create a Bull queue
const checkPackageQueue = new Queue("checkPackageExpiry", {
  redis: redisConfig,
});

// Create a Redlock instance
const redlock = new Redlock([redis.redis], {
  retryCount: 5,
  retryDelay: 200,
  retryJitter: 200,
});

// Define the job processing logic
checkPackageQueue.process(async () => {
  const lockKey = "lock:checkPackageExpiry";
  const ttl = 1000 * 60 * 5; // Lock TTL: 5 minutes

  try {
    // Acquire the lock
    const lock = await redlock.acquire([lockKey], ttl);
    console.log("[INFO] Acquired lock, starting package expiry check...");

    const now = new Date();

    // Find packages with expired deadlines
    const transactions = await Transection.find({
      validTil: { $lte: now },
      status: "success",
    });

    if (transactions.length > 0) {
      const updates = transactions.map(async (pkg) => {
        try {
          // Update transaction status to "expired"
          await Transection.updateOne({ _id: pkg._id }, { status: "expired" });

          // Reset user's package to "free"
          await User.updateOne(
            { _id: pkg.userId },
            { $set: { package: "free" } }
          );

          console.log(
            `[INFO] Transaction ${pkg._id} expired and user ${pkg.userId} updated to "free" package.`
          );
        } catch (err) {
          console.error(
            `[ERROR] Failed to update transaction ${pkg._id} or user ${pkg.userId}: ${err.message}`
          );
        }
      });

      await Promise.all(updates);

      console.log(`[INFO] Processed ${transactions.length} expired packages.`);
    } else {
      console.log("[INFO] No expired packages found.");
    }

    // Release the lock
    await lock.release();
    console.log("[INFO] Released lock.");
  } catch (error) {
    if (error.name === "LockError") {
      console.log("[INFO] Another server is already processing the job.");
    } else {
      console.error(
        `[ERROR] Error in checkPackageExpiry job: ${error.message}`
      );
    }
  }
});

module.exports = checkPackageQueue;
