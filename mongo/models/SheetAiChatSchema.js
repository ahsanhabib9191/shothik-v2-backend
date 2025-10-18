const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const sheetAiChatsSchema = new mongoose.Schema({
    userId: {
        type:  Types.ObjectId,
        ref: 'User',
        required: true,
    },
    sheetAiChatId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
    },
}, {
    timestamps: true,
});

sheetAiChatsSchema.index({userId: 1, sheetAiChatId: 1});
sheetAiChatsSchema.index({sheetAiChatId: 1, createdAt: -1});

module.exports = mongoose.model("SheetAiChats", sheetAiChatsSchema);
