const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

// Enum for roles
const RoleEnum = {
  USER: "user",
  ASSISTANT: "assistant",
};

// AssistantData Embedded Schema
const AssistantDataSchema = new Schema(
  {
    type: { type: String, required: true },
    message: { type: String },
    data: { type: Schema.Types.Mixed },
    agent_name: { type: String },
    status: { type: String },
  },
  { _id: false }
);

// UserData Embedded Schema
const UserDataSchema = new Schema(
  {
    message: { type: String, required: true },
    files: { type: [String], default: null },
  },
  { _id: false }
);

// Messages Embedded Schema
const MessagesSchema = new Schema(
  {
    role: {
      type: String,
      enum: Object.values(RoleEnum),
      required: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

// Agent Main Schema
const AgentSchema = new Schema({
  user_id: { type: Types.ObjectId, ref: "User", required: true },
  messages: [MessagesSchema],
  created_at: { type: Date, default: Date.now },
});

const AgentModel = model("Agent", AgentSchema);

module.exports = AgentModel;
