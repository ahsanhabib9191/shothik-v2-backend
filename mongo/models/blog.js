const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  banner: {
    type: String,
    required: true,
  },
  slag: {
    type: String,
    required: true,
    unique: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BlogCategory",
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
    default: null,
  },
  editorContent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: false,
    default: null,
  },
  metaTitle: {
    type: String,
    required: false,
    default: null,
  },
  metaDescription: {
    type: String,
    required: false,
    default: null,
  },
  metaKeywords: {
    type: String,
    required: false,
    default: null,
  },
  status: {
    type: String,
    enum: ["private", "public"],
    default: "private",
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  dislikes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Blog = mongoose.model("Blog", blogSchema);
module.exports = Blog;
