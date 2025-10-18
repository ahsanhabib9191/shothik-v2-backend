const { Schema, model } = require("mongoose");

const schema = new Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["free", "value_plan", "pro_plan", "unlimited"],
    unique: true,
  },
  bn: {
    amount_monthly: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0; // Optional: Ensure the value is non-negative
        },
        message: (props) => `${props.value} is not a valid monthly amount!`,
      },
    },
    amount_yearly: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0; // Optional: Ensure the value is non-negative
        },
        message: (props) => `${props.value} is not a valid monthly amount!`,
      },
    },

    monthly_plan_available: {
      type: Boolean,
      default: true,
      required: true, 
    },
    yearly_plan_available: {
      type: Boolean,
      default: true,
      required: true, 
    }
  },
  in: {
    amount_monthly: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0; // Optional: Ensure the value is non-negative
        },
        message: (props) => `${props.value} is not a valid monthly amount!`,
      },
    },
    amount_yearly: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0; // Optional: Ensure the value is non-negative
        },
        message: (props) => `${props.value} is not a valid monthly amount!`,
      },
    },

    monthly_plan_available: {
      type: Boolean,
      default: true,
      required: true, 
    },
    yearly_plan_available: {
      type: Boolean,
      default: true,
      required: true, 
    }
  },
  global: {
    amount_monthly: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0; // Optional: Ensure the value is non-negative
        },
        message: (props) => `${props.value} is not a valid monthly amount!`,
      },
    },
    amount_yearly: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v >= 0; // Optional: Ensure the value is non-negative
        },
        message: (props) => `${props.value} is not a valid monthly amount!`,
      },
    },

    monthly_plan_available: {
      type: Boolean,
      default: true,
      required: true, 
    },
    yearly_plan_available: {
      type: Boolean,
      default: true,
      required: true, 
    }
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  sl: {
    type: Number,
    default: 0,
  },
});

const Pricing = model("pricing", schema);

module.exports = {
  Pricing,
};
