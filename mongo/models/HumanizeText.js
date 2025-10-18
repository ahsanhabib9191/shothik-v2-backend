
const mongoose = require("mongoose");

const  { Schema } = require("mongoose");
const schema = new Schema({
    // user id will be here. 
    original: String,
    humanized: String,
    alternatives:{
        type:Array,
        default: []
    },
    
},
    {
        timestamps:true
    }
);
// model
const HumanizeContent = mongoose.model("humanizer-contents", schema);
module.exports =  {
    HumanizeContent
}

