require("colors");
const Redis = require("ioredis");
require("dotenv").config();


console.log(process.env.NODE_ENV);
// const host =
//   process.env.NODE_ENV === "development"
//     ? "redis-17830.c257.us-east-1-3.ec2.redns.redis-cloud.com"
//     : process.env.REDIS_HOST;
// const port = process.env.NODE_ENV === "development" ? 17830 : 6379;
// const password =
//   process.env.NODE_ENV === "development"
//     ? "1xh3E29Ix1HI5xeMba9pa6ZC69n5lloL"
//     : undefined;

// from Alamgir sir 👆. Currently it's full and not working

// Dev Mahedi credentials 👇
const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT;
const password = process.env.REDIS_PASSWORD;

const redisConfig = { host, port, password };

console.log("Redis CONFIG : ", redisConfig);

class RedisClient {
  constructor(options) {
    this.options = options || redisConfig;
    this.redis = new Redis(this.getRedisOptions());
    this.redis.on("connect", () => {
      console.log("Connected to Redis Cache Server");
    });
  }

  getRedisOptions() {
    const { host, port, password } = this.options;
    return {
      host,
      port,
      password,
      maxRetriesPerRequest: null, // Prevents unnecessary retries
      enableOfflineQueue: false, // Prevents queuing commands when Redis is down
      retryStrategy: (times) => Math.min(times * 50, 2000), // Limit retries
    };
  }

  // Method to set a key-value pair in Redis
  async set(key, value, expire = 300) {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", expire);
    } catch (error) {
      console.error(`Error setting key '${key}' in Redis:`, error);
    }
  }

  // Method to get the value of a key from Redis
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return JSON.parse(value);
    } catch (error) {
      console.error(
        `Error retrieving value for key '${key}' from Redis:`,
        error
      );
      return null;
    }
  }

  // Method to remove a key from Redis
  async remove(key) {
    try {
      const result = await this.redis.del(key);
      if (result === 1) {
        console.log(`Key '${key}' removed successfully from Redis.`);
      } else {
        console.log(`Key '${key}' does not exist in Redis.`);
      }
    } catch (error) {
      console.error(`Error removing key '${key}' from Redis:`, error);
    }
  }

  // Method to close the Redis connection
  async close() {
    try {
      await this.redis.quit();
      console.log("Redis connection closed.");
    } catch (error) {
      console.error("Error closing Redis connection:", error);
    }
  }

  // Method to pop an item from a list in Redis
  async lpop(listKey) {
    try {
      const item = await this.redis.lpop(listKey);
      if (item) {
        console.log(`Item '${item}' popped from list '${listKey}'.`);
        return JSON.parse(item);
      } else {
        console.log(`List '${listKey}' is empty.`);
        return null;
      }
    } catch (error) {
      console.error(`Error popping item from list '${listKey}':`, error);
      return null;
    }
  }

  async llen(listKey) {
    try {
      const length = await this.redis.llen(listKey);
      console.log(`Length of list '${listKey}': ${length}`);
      return length;
    } catch (error) {
      console.error(`Error getting length of list '${listKey}':`, error);
      return 0;
    }
  }

  async rpush(listKey, item) {
    try {
      await this.redis.rpush(listKey, item);
      console.log(`Item '${item}' pushed to list '${listKey}'.`);
    } catch (error) {
      console.error(`Error pushing item to list '${listKey}':`, error);
    }
  }

  // Method to flush all data from Redis
  async flushAll() {
    try {
      await this.redis.flushall();
      console.log("All Redis data flushed.");
    } catch (error) {
      console.error("Error flushing all Redis data:", error);
    }
  }
}

// Export Singleton Instance
const redisInstance = new RedisClient();
Object.freeze(redisInstance); // Prevent new instances

module.exports = {
  redis: redisInstance,
  redisConfig,
};
