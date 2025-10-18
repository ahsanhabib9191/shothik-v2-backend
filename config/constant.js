require("dotenv").config();

const MONGO_URI = ``;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_GEOLOCATION_KEY = "";
const GOOGLE_APPLICATION_CREDENTIALS = "../lib/serviceAccountKey.json";
const GOOGLE_CLOUD_PROJECT_ID = "shothikai-gcp";
const CLOUD_BUCKET = "shothik";
const EVENT_EMAIL = "hasan@shothik.ai";
const BOT_EMAIL = "shothik@shothik.ai";
const BOT_PASSWORD = "@Abc123@";
const STRIPE_SECRET_KEY =
  "";
const STRIPE_WEBHOOK_SECRET =
  "";
const SMPT_HOST = process.env.SMPT_HOST
  ? process.env.SMPT_HOST
  : "ensellers.com";
const SMPT_PORT = process.env.SMPT_PORT ? process.env.SMPT_PORT : "465";
const SMPT_MAIL = process.env.SMPT_MAIL
  ? process.env.SMPT_MAIL
  : "verify@shothik.ai";
const SMPT_PASSWORD = process.env.SMPT_PASSWORD
  ? process.env.SMPT_PASSWORD
  : "9*}tw*9e3z!q";
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY
  ? process.env.FCM_SERVER_KEY
  : "";

const CLIENT_URL = process.env.CLIENT_URI || "http://localhost:3031";
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const BYPASS_URL =
  process.env.BYPASS_URL || "http://103.49.200.66:8000/bypass?api_key=1234";

// RabbitMQ URL
const RABBITMQ_PORT = process.env.RABBITMQ_PORT || 5672;
const RABBITMQ_USER = process.env.RABBITMQ_USER || "secsbdxj";
const RABBITMQ_PASS =
  process.env.RABBITMQ_PASS || "";
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "";

const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY || "";
const AWS_SECRET_KEY =
  process.env.AWS_SECRET_KEY || "";
const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME || "recog-face-detect1";

const AZURE_SUBSCRIPTION_ID =
  process.env.AZURE_SUBSCRIPTION_ID || "";
const AZURE_SUBSCRIPTION_KEY =
  process.env.AZURE_SUBSCRIPTION_KEY || "";
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "eastus";

const SENDGRIDAPI =
  // ""; previous one
  ""; // new one

const MEETING_DURATION = process.env.MEETING_DURATION || 2;

const RUNPOD_API_KEY =
  process.env.RUNPOD_API_KEY || "";
const ENDPOINT_ID = process.env.ENDPOINT_ID || "";

const SOCKET_PORT = process.env.SOCKET_PORT || 8081;

const SLACK_ERROR_HOOK_URL = process.env.SLACK_ERROR_HOOK_URL || "";

const PACKAGES = {
  basic: {
    name: "basic",
    monthly: 0,
    yearly: 0,
  },
  starter: {
    name: "starter",
    monthly: 249,
    yearly: 2499,
  },
  premium: {
    name: "premium",
    monthly: 799,
    yearly: 7999,
  },
};

module.exports = {
  MONGO_URI,
  GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: GOOGLE_REDIRECT_URI,
  PACKAGES,
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_CLOUD_PROJECT_ID,
  CLOUD_BUCKET,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SMPT_HOST,
  SMPT_PORT,
  SMPT_MAIL,
  SMPT_PASSWORD,
  FCM_SERVER_KEY,
  CLIENT_URL,
  GOOGLE_GEOLOCATION_KEY,
  RABBITMQ_PORT,
  RABBITMQ_USER,
  RABBITMQ_PASS,
  RABBITMQ_URL,
  CHROME_PATH,
  BYPASS_URL,
  EVENT_EMAIL,
  BOT_EMAIL,
  BOT_PASSWORD,
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  AWS_REGION,
  AWS_BUCKET_NAME,
  AZURE_SUBSCRIPTION_ID,
  AZURE_SUBSCRIPTION_KEY,
  AZURE_SPEECH_REGION,
  MEETING_DURATION,
  SENDGRIDAPI,
  RUNPOD_API_KEY,
  ENDPOINT_ID,
  SOCKET_PORT,
  SLACK_ERROR_HOOK_URL,
};
