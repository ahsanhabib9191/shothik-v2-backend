const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const sheetAiConversationsSchema = new Schema({
    userId: {
        type:  Types.ObjectId,
        ref: 'User',
        required: true,
    },
    chatId: {
        type: Types.ObjectId,
        ref: 'SheetAiChats',
        required: true,
    },
    sheetAiConversationId: {
        type: String,
        // required: true,
    },
    prompt: {
        type: String,
    },
    response: {
        type: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
}, {
    timestamps: true,
});

sheetAiConversationsSchema.index({userId: 1, chatId: 1});
sheetAiConversationsSchema.index({sheetConversationId: 1, createdAt: -1});

module.exports = model("SheetAiConversations", sheetAiConversationsSchema);
