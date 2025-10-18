
const  { Schema , model } = require("mongoose");
const schema = new Schema({
    content: {
        type: String,
        required: true
    },
    phrase: {
        type: String,
        required: true
    },
    mode: {
        type: String,
        required: false
    },
    synonym: {
        type: String,
        required: false
    },
    model: {
        type: String,
        required: false
    },
    _date:{
        type:Date,
        default: Date.now()
    }
});
// model
const Paraphrase = model("paraphrase", schema);
module.exports =  {
    Paraphrase
}

