
const mongoose = require("mongoose");

const  { Schema } = require("mongoose");
const schema = new Schema({
    text: String,
    language: String,
    createdAt: {
        type: Date,
        default: Date.now()
    }
});
// model
const GenerateSampleText = mongoose.model("sample-text", schema);

module.exports =  {
    GenerateSampleText
}

