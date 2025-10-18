const amqp = require('amqplib');
const { RABBITMQ_URL } = require('./constant');

class RabbitMQClient {
  constructor(options) {
    this.options = options || {
      url: process.env.RABBITMQ_URL || RABBITMQ_URL,
    };
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.maxRetries = 5;
    this.retryCount = 0;
    this.retryDelay = 5000;

    this.connect();
  }

  // Method to connect to RabbitMQ
  async connect() {
    if (this.isConnecting) {
      console.log('Connection attempt already in progress...');
      return;
    }

    this.isConnecting = true;

    try {
      console.log('Attempting to connect to RabbitMQ...');
      console.log('Using URL:', this.options.url.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs
      
      this.connection = await amqp.connect(this.options.url);
      this.channel = await this.connection.createChannel();
      
      console.log('Connected to RabbitMQ Server successfully');
      this.retryCount = 0; // Reset retry count on successful connection
      this.isConnecting = false;

      // Set up connection event handlers
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err.message);
        this.handleConnectionError(err);
      });

      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed.');
        this.connection = null;
        this.channel = null;
        this.isConnecting = false;
        
        // Attempt to reconnect unless it's an authentication error
        if (this.retryCount < this.maxRetries) {
          setTimeout(() => this.connect(), this.retryDelay);
        }
      });

    } catch (error) {
      this.isConnecting = false;
      console.error('Error connecting to RabbitMQ:', error.message);
      
      // Handle specific error types
      if (error.message.includes('ACCESS_REFUSED')) {
        console.error('❌ Authentication failed. Please check your RabbitMQ credentials.');
        console.error('Verify the following:');
        console.error('1. Username and password are correct');
        console.error('2. User has necessary permissions');
        console.error('3. RabbitMQ instance is accessible');
        
        // Don't retry on authentication errors
        return;
      }
      
      // Retry for other types of errors
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying connection in ${this.retryDelay / 1000} seconds... (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.connect(), this.retryDelay);
      } else {
        console.error('❌ Maximum retry attempts reached. Please check your RabbitMQ configuration.');
      }
    }
  }

  // Handle connection errors
  handleConnectionError(error) {
    if (error.message.includes('ACCESS_REFUSED')) {
      console.error('❌ Authentication error occurred during connection.');
      return;
    }
    
    // For other errors, attempt to reconnect
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Attempting to reconnect... (${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => this.connect(), this.retryDelay);
    }
  }

  // Check if connected
  isConnected() {
    return this.connection && this.channel && !this.connection.connection.stream.destroyed;
  }

  // Method to create a queue
  async createQueue(queueName) {
    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to RabbitMQ');
      }
      
      await this.channel.assertQueue(queueName, { durable: true });
      console.log(`Queue "${queueName}" created successfully`);
    } catch (error) {
      console.error(`Error creating queue "${queueName}":`, error.message);
      throw error;
    }
  }

  // Method to send a message to a queue
  async sendMessage(queueName, message) {
    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to RabbitMQ');
      }
      
      const messageBuffer = Buffer.from(JSON.stringify(message));
      await this.channel.sendToQueue(queueName, messageBuffer, { persistent: true });
      console.log(`Message sent to queue "${queueName}"`);
    } catch (error) {
      console.error(`Error sending message to queue "${queueName}":`, error.message);
      throw error;
    }
  }

  // Method to consume messages from a queue
  async consumeMessages(queueName, callback) {
    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to RabbitMQ');
      }
      
      await this.channel.consume(queueName, (msg) => {
        if (msg !== null) {
          try {
            const content = msg.content.toString();
            callback(content);
            this.channel.ack(msg);
          } catch (error) {
            console.error('Error processing message:', error.message);
            this.channel.nack(msg, false, false); // Reject and don't requeue
          }
        }
      });
      
      console.log(`Started consuming messages from queue "${queueName}"`);
    } catch (error) {
      console.error(`Error consuming messages from queue "${queueName}":`, error.message);
      throw error;
    }
  }

  // Method to close the RabbitMQ connection
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
      console.log('RabbitMQ connection closed successfully');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error.message);
    }
  }

  // Method to gracefully shutdown
  async shutdown() {
    console.log('Shutting down RabbitMQ client...');
    this.retryCount = this.maxRetries; // Prevent reconnection attempts
    await this.close();
  }
}

// Create a single instance of RabbitMQClient for reusability
const rabbitMQClient = new RabbitMQClient();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await rabbitMQClient.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await rabbitMQClient.shutdown();
  process.exit(0);
});

module.exports = {
  rabbitMQClient,
  RabbitMQClient
};