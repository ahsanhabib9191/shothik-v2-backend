
const  { Schema , model, default: mongoose } = require("mongoose");
const ratingSchema = new Schema({
    meeting: {
        type: Schema.Types.ObjectId,
        ref: 'Meeting',
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    message: {
        type: String,
        default: '',
    },
},
{
    timestamps: true,
}
);
// model
const RatingModel = model("Rating", ratingSchema);
module.exports =  {
    RatingModel
}

