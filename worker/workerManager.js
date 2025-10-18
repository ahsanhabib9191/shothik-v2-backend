// workers/workerManager.js
const PresentationPersistenceWorker = require("./presentationPersistenceWorker");
const { queueClient } = require("../config/queueClient");

class WorkerManager {
  constructor(config = {}) {
    this.workers = new Map();
    this.isShuttingDown = false;
    this.healthCheckInterval = null;
    this.restartAttempts = new Map();
    this.maxRestartAttempts = 3;
    this.restartDelay = 10000; // 10 seconds
    this.config = {
      workerCount: config.workerCount || 1, // Default to 1 workers
      ...config,
    };
  }

  async initialize() {
    try {
      console.log("[WorkerManager] Initializing worker manager...");

      // Connect to queue client
      await queueClient.connect();

      // Start multiple presentation persistence workers
      for (let i = 0; i < this.config.workerCount; i++) {
        await this.startWorker(
          `presentationPersistence_${i}`,
          PresentationPersistenceWorker
        );
      }

      // Start health monitoring
      this.startHealthMonitoring();

      console.log("[WorkerManager] Worker manager initialized successfully");
    } catch (error) {
      console.error(
        "[WorkerManager] Failed to initialize worker manager:",
        error
      );
      throw error;
    }
  }

  async startWorker(workerName, WorkerClass) {
    try {
      if (this.workers.has(workerName)) {
        console.log(`[WorkerManager] Worker ${workerName} already exists`);
        return;
      }

      console.log(`[WorkerManager] Starting worker: ${workerName}`);

      const worker = new WorkerClass();
      await worker.start();

      this.workers.set(workerName, {
        instance: worker,
        class: WorkerClass,
        startedAt: new Date(),
        status: "running",
        restarts: 0,
      });

      console.log(`[WorkerManager] Worker ${workerName} started successfully`);
    } catch (error) {
      console.error(
        `[WorkerManager] Failed to start worker ${workerName}:`,
        error
      );
      await this.scheduleWorkerRestart(workerName, WorkerClass, error);
      throw error;
    }
  }

  async stopWorker(workerName) {
    try {
      const workerInfo = this.workers.get(workerName);
      if (!workerInfo) {
        console.log(`[WorkerManager] Worker ${workerName} not found`);
        return;
      }

      console.log(`[WorkerManager] Stopping worker: ${workerName}`);

      if (
        workerInfo.instance &&
        typeof workerInfo.instance.stop === "function"
      ) {
        await workerInfo.instance.stop();
      }

      workerInfo.status = "stopped";
      this.workers.delete(workerName);

      console.log(`[WorkerManager] Worker ${workerName} stopped successfully`);
    } catch (error) {
      console.error(
        `[WorkerManager] Failed to stop worker ${workerName}:`,
        error
      );
      throw error;
    }
  }

  async restartWorker(workerName) {
    try {
      const workerInfo = this.workers.get(workerName);
      if (!workerInfo) {
        console.log(
          `[WorkerManager] Worker ${workerName} not found for restart`
        );
        return;
      }

      console.log(`[WorkerManager] Restarting worker: ${workerName}`);

      // Increment restart counter
      workerInfo.restarts += 1;

      // Stop existing worker
      await this.stopWorker(workerName);

      // Wait before restarting
      await this.sleep(2000);

      // Start new instance
      await this.startWorker(workerName, workerInfo.class);

      console.log(
        `[WorkerManager] Worker ${workerName} restarted successfully`
      );
    } catch (error) {
      console.error(
        `[WorkerManager] Failed to restart worker ${workerName}:`,
        error
      );
      throw error;
    }
  }

  async scheduleWorkerRestart(workerName, WorkerClass, error) {
    const attempts = this.restartAttempts.get(workerName) || 0;

    if (attempts >= this.maxRestartAttempts) {
      console.error(
        `[WorkerManager] Max restart attempts reached for ${workerName}. Giving up.`
      );
      return;
    }

    this.restartAttempts.set(workerName, attempts + 1);

    const delay = this.restartDelay * Math.pow(2, attempts); // Exponential backoff

    console.log(
      `[WorkerManager] Scheduling restart for ${workerName} in ${delay}ms (attempt ${
        attempts + 1
      }/${this.maxRestartAttempts})`
    );

    setTimeout(async () => {
      try {
        await this.startWorker(workerName, WorkerClass);
        this.restartAttempts.delete(workerName); // Reset on success
      } catch (restartError) {
        console.error(
          `[WorkerManager] Restart attempt failed for ${workerName}:`,
          restartError
        );
        await this.scheduleWorkerRestart(workerName, WorkerClass, restartError);
      }
    }, delay);
  }

  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error("[WorkerManager] Health check failed:", error);
      }
    }, 30000); // Check every 30 seconds
  }

  async performHealthCheck() {
    const unhealthyWorkers = [];

    for (const [workerName, workerInfo] of this.workers.entries()) {
      try {
        // Check if worker is running and healthy
        if (
          !workerInfo.instance.isRunning ||
          !(await workerInfo.instance.healthCheck())
        ) {
          unhealthyWorkers.push(workerName);
        }
      } catch (error) {
        console.error(
          `[WorkerManager] Health check failed for ${workerName}:`,
          error
        );
        unhealthyWorkers.push(workerName);
      }
    }

    // Restart unhealthy workers
    for (const workerName of unhealthyWorkers) {
      console.log(`[WorkerManager] Restarting unhealthy worker: ${workerName}`);
      try {
        await this.restartWorker(workerName);
      } catch (error) {
        console.error(
          `[WorkerManager] Failed to restart unhealthy worker ${workerName}:`,
          error
        );
      }
    }
  }

  getWorkerStatus() {
    const status = {
      totalWorkers: this.workers.size,
      workers: {},
      queueStatus: queueClient.isConnected() ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };

    for (const [workerName, workerInfo] of this.workers.entries()) {
      status.workers[workerName] = {
        status: workerInfo.status,
        startedAt: workerInfo.startedAt,
        restarts: workerInfo.restarts,
        uptime: Date.now() - workerInfo.startedAt.getTime(),
      };
    }

    return status;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop() {
    console.log("[WorkerManager] Stopping all workers...");

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const stopPromises = Array.from(this.workers.keys()).map((workerName) =>
      this.stopWorker(workerName)
    );

    await Promise.allSettled(stopPromises);
    await queueClient.close();

    console.log("[WorkerManager] All workers stopped");
  }
}

module.exports = WorkerManager;
