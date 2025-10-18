
const mongoose = require("mongoose");
const  { Schema } = require("mongoose");
const schema = new Schema({
    // user id will be here. 
    token: String,
    expire: Number,
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        default:""
    },
    password: {
        type: String,
        required: true,
        default:""
    },
    active:{
        type: Boolean,
        default: false
    }
},
    {
        timestamps:true
    }
);
// model
const StealthToken = mongoose.model("stealth-tokens", schema);
module.exports =  {
    StealthToken
}

