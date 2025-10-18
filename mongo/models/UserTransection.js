const { Schema, model, default: mongoose } = require("mongoose");
const { Moment } = require("../../lib/moment");
const schema = new Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    package: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["bkash", "stripe", "razorpay", "manual"],
      default: "bkash",
    },
    plan: {
      type: String,
      required: true,
      enum: ["monthly", "yearly"],
    },
    // is Deleted
    status: {
      type: String,
      enum: ["success", "failed", "pending", "expired"],
      default: "success",
    },
    _date: {
      type: Date,
      default: Moment(),
    },
    validTil: {
      type: Date,
      required: true,
    },

    // json data
    payload: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);
// model
const Transection = model("transections", schema);
module.exports = {
  Transection,
};
