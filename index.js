const express = require("express");
const morgan = require("morgan");
const { connectDB } = require("./mongo");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { execSync } = require("child_process");
const pkg = require("./package.json");
const fileUpload = require("express-fileupload");
const { connectSocket } = require("./config/socket.js");
const {
  authLimiter,
  paymentLimiter,
  globalLimiter,
} = require("./services/requestLimit.js");
const checkPackageQueue = require("./lib/Queue.js");

const authService = require('@ridz-shothikai/shothik-auth-service');

const WorkerManager = require("./worker/workerManager.js");
const PresentationService = require("./services/presentationService");
const { queueClient } = require("./config/queueClient");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 8080;

let workerManager = new WorkerManager();
let server = null;

async function initialize() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log("[INFO] Connected to MongoDB");

    // Initialize worker manager (includes queue connection)
    await workerManager.initialize();
    console.log("[INFO] Worker manager initialized");

    // Set up Express middleware
    app.use(
      cors({
        origin: "*",
        credentials: true,
      })
    );
    app.use(cookieParser());
    app.use(
      fileUpload({
        limits: { fileSize: 500 * 1024 * 1024 },
        useTempFiles: true,
        tempFileDir: "/tmp/",
      })
    );

    // Webhook routes with raw body parser
    const prefix = process.env.PREFIX ?? "/api";
    app.use(
      `${prefix}/payment/stripe/webhook`,
      express.raw({ type: "application/json" })
    );
    app.use(
      `${prefix}/payment/razor/webhook`,
      express.raw({ type: "application/json" })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true}));
    app.use(morgan("dev"));
    
    // app.options(
    //   "*",
    //   cors({
    //     origin: true,
    //     credentials: true,
    //   })
    // );

    app.set("trust proxy", 1);

    // Request limit middleware
    console.log("PREFIX", prefix);
    app.use(`${prefix}`, globalLimiter);
    app.use(`${prefix}/auth`, authLimiter);
    app.use(`${prefix}/payment`, paymentLimiter);
    // connectDB();
    // Initial route
    app.get(`${prefix}/`, (req, res) => {
      console.log("hitting");
      res.status(200).json({
        success: true,
        message: "Welcome to SHOTHIK AI",
        version: pkg.version,
        prefix: prefix,
      });
    });

    // Health check endpoint
    app.get(`${prefix}/health`, (req, res) => {
      res.status(200).json({
        status: "healthy",
        queueHealth: PresentationService.getQueueHealthStatus(),
        workerStatus: workerManager.getWorkerStatus(),
        timestamp: new Date().toISOString(),
      });
    });

// Routes
app.use(`${prefix}/folder`, require("./routes/folder"));
app.use(`${prefix}/meeting-minute`, require("./routes/googleMeet"));
app.use(`${prefix}/dashboard`, require("./routes/dashboard"));
app.use(`${prefix}/report`, require("./routes/report"));
app.use(`${prefix}/admin`, require("./routes/admin"));
app.use(`${prefix}/transection`, require("./routes/transection"));
app.use(`${prefix}/transcription`, require("./routes/transcription"));
app.use(`${prefix}/pricing`, require("./routes/pricing"));
// app.use(`${prefix}/auth`, authService);
app.use(`${prefix}/auth`, require("./routes/auth.js"));
app.use(`${prefix}/payment`, require("./routes/payment"));
app.use(`${prefix}/user`, require("./routes/user"));
app.use(`${prefix}/usage`, require("./routes/usage"));
app.use(`${prefix}/blog`, require("./routes/blog"));
app.use(`${prefix}/gemini-api`, require("./routes/geminiapikeys.js"));
app.use(`${prefix}/presentation`, require("./routes/presentation.js"));
app.use(`${prefix}/sheet`, require("./routes/sheet.js"));
app.use(`${prefix}/research`, require("./routes/research.js"));
app.use(`${prefix}/share`, require("./routes/shareSlide.js"));

app.use(`${prefix}`, require("./routes"));

    // Version endpoint
    app.get(`${prefix}/version`, (req, res) => {
      let version = pkg.version;
      let commitHash = "unknown";
      try {
        commitHash = execSync("git rev-parse --short HEAD").toString().trim();
      } catch (error) {
        console.error("Error getting git commit hash:", error);
      }
      res.json({
        version: version,
        commitHash: commitHash,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
      });
    });

    // Error handler middleware
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        success: false,
        message: err.message || "There was a server error",
      });
    });

    // Set up presentation task consumer
    await PresentationService.setupPresentationTaskConsumer((taskData) => {
      console.log(
        `[INFO] Processing task for presentation ${taskData.presentationId}`
      );
      // Add custom task processing logic if needed
    });

    // Schedule the checkPackageQueue job
    await checkPackageQueue.add({}, { repeat: { cron: "0 0 * * *" } });
    console.log("[INFO] Scheduled checkPackageExpiry job with Bull.");

    // Log queue job status
    const jobs = await checkPackageQueue.getJobs([
      "completed",
      "failed",
      "active",
    ]);
    console.log(
      "Completed jobs: ",
      jobs.filter((job) => job.isCompleted()).length
    );
    console.log("Failed jobs: ", jobs.filter((job) => job.isFailed()).length);
    console.log("Active jobs: ", jobs.filter((job) => job.isActive()).length);

    // Start server with socket
    server = await connectSocket(app);
    server.listen(port, () => {
      console.log(process.env.JWT_SECRET)
      console.log(`Server with Socket is running on http://localhost:${port}`);
    });

    // Set up graceful shutdown
    setupGracefulShutdown();
  } catch (error) {
    console.error("[ERROR] Failed to initialize:", error);
    await shutdown();
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  const shutdown = async () => {
    console.log("[INFO] Shutting down...");
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        console.log("[INFO] Express server closed");
      }
      await workerManager.stop();
      console.log("[INFO] Worker manager stopped");
      await require("mongoose").disconnect();
      console.log("[INFO] MongoDB disconnected");
      process.exit(0);
    } catch (error) {
      console.error("[ERROR] Shutdown error:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

async function shutdown() {
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await workerManager.stop();
    await require("mongoose").disconnect();
  } catch (error) {
    console.error("[ERROR] Error during shutdown:", error);
  }
}

// Start the application
initialize();
