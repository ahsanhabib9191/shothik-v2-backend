
const mongoose = require("mongoose");

const  { Schema } = require("mongoose");
const schema = new Schema({
    // user id will be here. 
    file: String,
    browserId: String,
    createdAt: {
        type: Date,
        default: Date.now()
    },
    text: String,
    keyNote: String,
    status: {
        type: String,
        default: "pending"
    }
});
// model
const KeyNoteFile = mongoose.model("key-note-files", schema);
module.exports =  {
    KeyNoteFile
}

