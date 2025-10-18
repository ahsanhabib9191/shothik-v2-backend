// config/queueClient.js
const amqp = require("amqplib");
const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const { RABBITMQ_URL } = require("./constant");
const { redisConfig } = require("../lib/Redis");

// Queue types enum
const QUEUE_TYPES = {
  RABBITMQ: "rabbitmq",
  BULLMQ: "bullmq",
};

class QueueClient {
  constructor(options) {
    this.options = options || {
      url: process.env.RABBITMQ_URL || RABBITMQ_URL,
    };

    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.maxRetries = 3;
    this.retryCount = 0;
    this.retryDelay = 5000;
    this.redis = null;
    this.queues = new Map();
    this.workers = new Map(); // Will store arrays of workers: Map<string, Worker[]>
    this.currentQueueType = QUEUE_TYPES.RABBITMQ;
  }

  async connect() {
    try {
      await this.connectRabbitMQ();
    } catch (error) {
      console.log("RabbitMQ connection failed, falling back to BullMQ...");
      await this.fallbackToBullMQ();
    }
  }

  async connectRabbitMQ() {
    if (this.isConnecting) {
      console.log("RabbitMQ connection attempt already in progress...");
      return;
    }

    this.isConnecting = true;

    try {
      console.log("Attempting to connect to RabbitMQ...");
      console.log(
        "Using URL:",
        this.options.url.replace(/\/\/.*@/, "//***:***@")
      );

      this.connection = await amqp.connect(this.options.url);
      this.channel = await this.connection.createChannel();

      console.log("✅ Connected to RabbitMQ Server successfully");
      this.retryCount = 0;
      this.isConnecting = false;
      this.currentQueueType = QUEUE_TYPES.RABBITMQ;

      this.connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err.message);
        this.handleRabbitMQError(err);
      });

      this.connection.on("close", () => {
        console.log("RabbitMQ connection closed.");
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
        this.fallbackToBullMQ();
      });
    } catch (error) {
      this.isConnecting = false;
      console.error("Error connecting to RabbitMQ:", error.message);

      if (error.message.includes("ACCESS_REFUSED")) {
        console.error("❌ RabbitMQ Authentication failed");
        throw error;
      }

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(
          `Retrying RabbitMQ connection in ${
            this.retryDelay / 1000
          } seconds... (${this.retryCount}/${this.maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.connectRabbitMQ();
      } else {
        console.error("❌ Maximum RabbitMQ retry attempts reached");
        throw error;
      }
    }
  }

  async handleRabbitMQError(error) {
    console.error("RabbitMQ error occurred:", error.message);
    await this.fallbackToBullMQ();
  }

  async fallbackToBullMQ() {
    if (this.currentQueueType === QUEUE_TYPES.BULLMQ) {
      console.log("Already using BullMQ, skipping fallback...");
      return;
    }

    try {
      console.log("🔄 Falling back to BullMQ...");

      this.redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      });

      await this.redis.ping();
      console.log("✅ Connected to Redis for BullMQ successfully");

      this.currentQueueType = QUEUE_TYPES.BULLMQ;

      this.redis.on("error", (err) => {
        console.error("Redis connection error:", err.message);
      });

      this.redis.on("connect", () => {
        console.log("Redis connected successfully");
      });
    } catch (error) {
      console.error("❌ Failed to fallback to BullMQ:", error.message);
      throw new Error("Both RabbitMQ and BullMQ are unavailable");
    }
  }

  async createQueue(queueName) {
    try {
      if (this.currentQueueType === QUEUE_TYPES.RABBITMQ) {
        await this.createRabbitMQQueue(queueName);
      } else {
        await this.createBullMQQueue(queueName);
      }
      console.log(
        `✅ Queue "${queueName}" created successfully using ${this.currentQueueType}`
      );
    } catch (error) {
      console.error(`❌ Error creating queue "${queueName}":`, error.message);
      throw error;
    }
  }

  async createRabbitMQQueue(queueName) {
    if (!this.isRabbitMQConnected()) {
      throw new Error("Not connected to RabbitMQ");
    }
    await this.channel.assertQueue(queueName, { durable: true });
  }

  async createBullMQQueue(queueName) {
    if (!this.redis) {
      throw new Error("Redis not initialized for BullMQ");
    }

    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      });

      this.queues.set(queueName, queue);
    }
  }

  async sendMessage(queueName, message) {
    try {
      if (this.currentQueueType === QUEUE_TYPES.RABBITMQ) {
        await this.sendRabbitMQMessage(queueName, message);
      } else {
        await this.sendBullMQMessage(queueName, message);
      }
      console.log(
        `✅ Message sent to queue "${queueName}" using ${this.currentQueueType}`
      );
    } catch (error) {
      console.error(
        `❌ Error sending message to queue "${queueName}":`,
        error.message
      );

      if (this.currentQueueType === QUEUE_TYPES.RABBITMQ) {
        console.log("Attempting to fallback to BullMQ and retry...");
        await this.fallbackToBullMQ();
        await this.sendBullMQMessage(queueName, message);
        console.log(
          `✅ Message sent to queue "${queueName}" using BullMQ fallback`
        );
      } else {
        throw error;
      }
    }
  }

  async sendRabbitMQMessage(queueName, message) {
    if (!this.isRabbitMQConnected()) {
      throw new Error("Not connected to RabbitMQ");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    await this.channel.sendToQueue(queueName, messageBuffer, {
      persistent: true,
    });
  }

  async sendBullMQMessage(queueName, message) {  
    await this.createBullMQQueue(queueName);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`BullMQ queue "${queueName}" not found`);
    }

    await queue.add("process", message, {
      priority: 1,
      delay: 0,
    });
  }

  async consumeMessages(queueName, callback) { 
    try {
      if (this.currentQueueType === QUEUE_TYPES.RABBITMQ) {
        await this.consumeRabbitMQMessages(queueName, callback);
      } else {
        await this.consumeBullMQMessages(queueName, callback);
      }
      console.log(
        `✅ Started consuming messages from queue "${queueName}" using ${this.currentQueueType}`
      );
    } catch (error) {
      console.error(
        `❌ Error consuming messages from queue "${queueName}":`,
        error.message
      );
      throw error;
    }
  }

  async consumeRabbitMQMessages(queueName, callback) {
    if (!this.isRabbitMQConnected()) {
      throw new Error("Not connected to RabbitMQ");
    }

    await this.channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        try {
          await callback(msg.content.toString());
          this.channel.ack(msg);
        } catch (error) {
          console.error("Error processing RabbitMQ message:", error.message);
          this.channel.nack(msg, false, false);
        }
      }
    });
  }

  // --- START OF MULTIPLE WORKER SECTION ---

  async consumeBullMQMessages(queueName, callback) {
    // We now create a new worker every time this is called.

    // A unique identifier for logging purposes for each worker instance.
    const workerId = `${queueName}-worker-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    console.log(`[QueueClient] Creating a new BullMQ worker: ${workerId}`);

    const worker = new Worker(
      queueName,
      async (job) => {
        try {
          const content = JSON.stringify(job.data);
          await callback(content);
          return { success: true };
        } catch (error) {
          console.error(
            `Error processing BullMQ job ${job.id} on worker ${workerId}:`,
            error.message
          );
          throw error;
        }
      },
      {
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
        },
        concurrency: 5, // Each worker instance can process 5 jobs concurrently
      }
    );

    worker.on("completed", (job) => {
      console.log(
        `BullMQ job ${job.id} on worker ${workerId} completed successfully`
      );
    });

    worker.on("failed", (job, err) => {
      console.error(
        `BullMQ job ${job.id} on worker ${workerId} failed:`,
        err.message
      );
    });

    // Store workers in an array to allow multiple per queue.
    if (!this.workers.has(queueName)) {
      this.workers.set(queueName, []);
    }
    this.workers.get(queueName).push(worker);
  }

  isRabbitMQConnected() {
    return (
      this.connection &&
      this.channel &&
      this.connection.connection &&
      this.connection.connection.stream &&
      !this.connection.connection.stream.destroyed
    );
  }

  isBullMQConnected() {  
    return this.redis && this.redis.status === "ready";
  }

  isConnected() {
    return this.currentQueueType === QUEUE_TYPES.RABBITMQ
      ? this.isRabbitMQConnected()
      : this.isBullMQConnected();
  }

  getCurrentQueueType() {    
    return this.currentQueueType;
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }

      for (const [name, queue] of this.queues) {
        await queue.close();
      }
      this.queues.clear();

      // Handle the array of workers correctly.
      for (const [queueName, workerArray] of this.workers) {
        console.log(
          `[QueueClient] Closing ${workerArray.length} workers for queue: ${queueName}`
        );
        for (const worker of workerArray) {
          await worker.close();
        }
      }
      this.workers.clear();

      console.log("✅ All queue connections closed successfully");
    } catch (error) {
      console.error("❌ Error closing queue connections:", error.message);
    }
  }

  async shutdown() {
    console.log("🔄 Shutting down queue client...");
    this.retryCount = this.maxRetries;
    await this.close();
  }
}

const queueClient = new QueueClient();

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await queueClient.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await queueClient.shutdown();
  process.exit(0);
});

module.exports = {
  queueClient,
  QueueClient,
  QUEUE_TYPES,
};
