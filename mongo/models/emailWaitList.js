const mongoose = require("mongoose");

const emailWaitListSchema = new mongoose.Schema({

});

const emailWaitList = mongoose.model("waitlist-email", emailWaitListSchema);