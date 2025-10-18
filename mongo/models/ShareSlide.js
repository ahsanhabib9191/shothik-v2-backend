const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ShareSettingsSchema = new mongoose.Schema({
  presentationId: {
    // type: mongoose.Schema.Types.ObjectId, // This will be used when we make the presentation model and take presentation from agent to our shothik system
    type: String,
    ref: "Presentation",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shareLink: { type: String, unique: true, required: true },
  isDiscoverable: { type: Boolean, default: false },
  requireSignIn: { type: Boolean, default: false },
  allowComments: { type: Boolean, default: true },
  allowDownload: { type: Boolean, default: true },
  trackViews: { type: Boolean, default: true },
  password: { type: String, default: "" }, // Hashed if set
  expiryDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Hash password before saving if set
ShareSettingsSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  this.updatedAt = Date.now();
  next();
});

const ShareAnalyticsSchema = new mongoose.Schema({
  shareId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShareSettings",
    required: true,
  },
  views: { type: Number, default: 0 },
  uniqueVisitors: [{ type: String }], // Store client IPs or user IDs
  lastViewed: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = {
  ShareSettings: mongoose.model("ShareSettings", ShareSettingsSchema),
  ShareAnalytics: mongoose.model("ShareAnalytics", ShareAnalyticsSchema),
};
