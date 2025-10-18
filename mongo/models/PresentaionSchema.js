// models/Presentation.js
const mongoose = require("mongoose");

const presentationLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    agent_name: { type: String, required: true },
    parsed_output: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const presentationSlideSchema = new mongoose.Schema(
  {
    slide_index: { type: Number, required: true },
    thought: { type: String },
    body: { type: String, required: true },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const presentationSchema = new mongoose.Schema(
  {
    presentationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["initiated", "processing", "completed", "failed", "saved"],
      default: "initiated",
      index: true,
    },
    queueType: {
      type: String,
      enum: ["rabbitmq", "bullmq"],
      required: true,
    },

    // Agent processing metadata
    agentMetadata: {
      processedAt: { type: Date },
      processedBy: { type: String },
      processingDuration: { type: Number },
      agentVersion: { type: String },
    },

    // CHAT history
    chatHistory: [chatMessageSchema],

    // Presentation content
    slides: [presentationSlideSchema],
    logs: [presentationLogSchema],
    totalSlides: { type: Number, default: 0 },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    savedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "presentations",
  }
);

// Indexes for efficient querying
presentationSchema.index({ userId: 1, createdAt: -1 });
presentationSchema.index({ presentationId: 1, userId: 1 });
presentationSchema.index({ status: 1, createdAt: -1 });

// Virtual for presentation URL or other computed fields
presentationSchema.virtual("isCompleted").get(function () {
  return this.status === "completed" || this.status === "saved";
});

// Pre-save middleware to update timestamps
presentationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (this.status === "saved" && !this.savedAt) {
    this.savedAt = new Date();
  }
  next();
});

// Static methods for common queries
presentationSchema.statics.findByUserAndId = function (userId, presentationId) {
  return this.findOne({ userId, presentationId });
};

presentationSchema.statics.findByUser = function (
  userId,
  limit = 10,
  skip = 0
) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .select("-logs"); // Exclude logs for list view
};

presentationSchema.statics.findPendingSaves = function (limit = 50) {
  return this.find({
    status: "completed",
    savedAt: { $exists: false },
  })
    .sort({ completedAt: 1 })
    .limit(limit);
};

// Instance methods
presentationSchema.methods.markAsCompleted = function () {
  this.status = "completed";
  this.completedAt = new Date();
  return this.save();
};

presentationSchema.methods.markAsSaved = function () {
  this.status = "saved";
  this.savedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("Presentation", presentationSchema);
