const mongoose = require("mongoose");
const { createPayment } = require("../action/createPayment.js");
const executePayment = require("../action/executePayment.js");
const queryPayment = require("../action/queryPayment.js");
const searchTransaction = require("../action/searchTransaction.js");
const refundTransaction = require("../action/refundTransaction.js");
const { bkashConfig } = require("../config/bkashConfig.js");
const { log } = require("../lib/log.js");
const { Transection } = require("../mongo/models/UserTransection.js");
const { Pricing } = require("../mongo/models/Pricing.js");
const { updateTransaction } = require("../lib/updateTransaction.js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { default: axios } = require("axios");
const { saveErrorLog } = require("../mongo/models/ErrorLogs.js");

//============================== Bkash Payment ===================================
const bkashCheckout = async (req, res) => {
  try {
    const { pricingId } = req.body;

    const pricingID = new mongoose.Types.ObjectId(pricingId);
    if (!pricingID) {
      throw { message: "pricing id is required" };
    }

    const existPricing = await Pricing.findById(pricingID);

    if (!existPricing) {
      throw { message: "pricing is invalid" };
    }

    req.body.package = existPricing?.type;
    req.body.user = req.user;

    const transaction = await createPayment(req.body, req.id);

    console.log("BKASH TRANSECTION: ", transaction)

    res.json(transaction);
  } catch (error) {
    // Log error for debugging
    saveErrorLog(error.message, "high", {}, "Bkash payment", req.user?.email);
    res.status(500).json({ error: error.message });
  }
};

const bkashCallback = async (req, res) => {
  try {
    if (req.query.status === "success") {
      let response = await executePayment(req.query.paymentID);
      if (response.message) {
        response = await queryPayment(req.query.paymentID);
      }

      if (response.statusCode && response.statusCode === "0000") {
        const query = req.query;
        updateTransaction(
          query.tranx_id,
          query.type,
          query.user_id,
          query.package
        );
      } else {
        // failed
        return res.redirect(
          `${bkashConfig.frontend_fail_url}?data=${response.statusMessage}`
        );
      }

      // Your frontend success route
      return res.redirect(
        `${bkashConfig.frontend_success_url}?data=${response.statusMessage}`
      );
    } else {
      // Your frontend failed route
      res.redirect(bkashConfig.frontend_fail_url);
    }
  } catch (error) {
    // Log error for debugging
    saveErrorLog(error.message, "high", {}, "Bkash payment", req.user?.email);
    res.status(500).json({ error: error.message });
  }
};

const search = async (req, res) => {
  try {
    res.send(await searchTransaction(req.body.trxID));
  } catch (e) {
    log(e);
  }
};

const refund = async (req, res) => {
  try {
    res.send(await refundTransaction(req.body));
  } catch (e) {
    log(e);
  }
};

const refundStatus = async (req, res) => {
  try {
    res.send(await refundTransaction(req.body));
  } catch (e) {
    log(e);
  }
};

//============================== Stripe Payment ===================================

const stripeCheckout = async (req, res) => {
  const { pricingId, amount, payment_type } = req.body;
  try {
    const pricingID = new mongoose.Types.ObjectId(pricingId);
    const existPricing = await Pricing.findById(pricingID);

    if (!existPricing) {
      throw { message: "Pricing is invalid" };
    }

    req.body.package = existPricing?.type;
    req.body.user = req.user;

    let validTil = new Date();
    if (payment_type === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
    } else if (payment_type === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
    }

    const transaction = await new Transection({
      userId: req.id,
      amount: amount,
      package: existPricing?.type,
      plan: payment_type,
      validTil,
      status: "pending",
      paymentMethod: "stripe",
    }).save();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: existPricing.title,
            },
            unit_amount: Math.ceil(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: process.env.CLIENT_URI + "/payment/success",
      cancel_url: process.env.CLIENT_URI + "/payment/failed",
      metadata: {
        pricingId,
        package: existPricing?.type,
        userId: req.user._id.toString(),
        amount,
        type: payment_type,
        transactionId: transaction._id.toString(),
      },
    });

    try {
      const SLACK_PAYMENT_HOOK_URL = process.env.SLACK_PAYMENT_HOOK_URL;

      // Send a notification to Slack;
      const slackMessage = {
        text: `*Payment transaction:*\n- *User:* ${
          req.user.email
        }\n- *Transaction Id:* ${transaction._id.toString()}\n- *Amount:* ${amount}\n- *Package:* ${
          existPricing?.type
        }\n- *Plan:* ${payment_type}\n- *Status:* pending\n- *Payment method:* stripe\n- *Date:* ${new Date().toLocaleString()}`,
      };
      await axios.post(SLACK_PAYMENT_HOOK_URL, slackMessage);
    } catch (error) {}

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.log(error);
    // Log error for debugging
    saveErrorLog(error.message, "high", {}, "Stripe payment", req.user?.email);
    res.status(500).json({ error: error.message });
  }
};

const stripeCallback = async (req, res) => {
  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      throw { message: "Payment validation failed" };
    }
    const email = JSON.parse(req.body.toString())?.data?.object
      ?.customer_details?.email;
    req.email = email;

    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      endpointSecret
    );
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const metadata = session.metadata;
      const { transactionId, type, userId, package, amount } = metadata;
      await updateTransaction(transactionId, type, userId, package);

      try {
        // Send a notification to Slack;
        const SLACK_PAYMENT_HOOK_URL = process.env.SLACK_PAYMENT_HOOK_URL;
        const slackMessage = {
          text: `*Payment received:*\n- *User:* ${
            req.email
          }\n- *Transaction Id:* ${transactionId}\n- *Amount:* ${amount}\n- *Package:* ${type}\n- *Plan:* ${package}\n- *Status:* success\n- *Payment method:* stripe\n- *Date:* ${new Date().toLocaleString()}`,
        };
        await axios.post(SLACK_PAYMENT_HOOK_URL, slackMessage);
      } catch (error) {}

      res.send({ success: true, message: "Payment successful" });
    } else {
      throw { message: "Payment validation failed" };
    }
  } catch (err) {
    // Log error for debugging
    saveErrorLog(err.message, "high", {}, "Stripe payment", req.email);
    res.status(500).send({ success: false, message: err.message });
  }
};

//============================== Razonpay Payment ===================================

const razonpayCheckout = async (req, res) => {
  const { pricingId, amount, payment_type } = req.body;

  try {
    const pricingID = new mongoose.Types.ObjectId(pricingId);
    const existPricing = await Pricing.findById(pricingID);

    if (!existPricing) {
      throw new Error("Pricing is invalid");
    }

    req.body.package = existPricing?.type;
    req.body.user = req.user;

    let validTil = new Date();
    if (payment_type === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
    } else if (payment_type === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
    }

    const transaction = await new Transection({
      userId: req.id,
      amount: amount,
      package: existPricing?.type,
      plan: payment_type,
      validTil,
      status: "pending",
      paymentMethod: "razorpay",
    }).save();

    const razorpay = new Razorpay({
      key_id: process.env.KEY_ID,
      key_secret: process.env.KEY_SECRET,
    });

    const session = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: transaction._id,
      notes: {
        pricingId,
        package: existPricing?.type,
        userId: req.user._id.toString(),
        amount,
        type: payment_type,
        transactionId: transaction._id.toString(),
        success_url: process.env.CLIENT_URI + "/payment/success",
        failed_url: process.env.CLIENT_URI + "/payment/failed",
      },
    });

    const payload = {
      id: session.id,
      amount: amount * 100,
      currency: "INR",
      notes: session.notes,
    };

    try {
      const SLACK_PAYMENT_HOOK_URL = process.env.SLACK_PAYMENT_HOOK_URL;

      // Send a notification to Slack;
      const slackMessage = {
        text: `*Payment transaction:*\n- *User:* ${
          req.user.email
        }\n- *Transaction Id:* ${transaction._id.toString()}\n- *Amount:* ${amount}\n- *Package:* ${
          existPricing?.type
        }\n- *Plan:* ${payment_type}\n- *Status:* pending\n- *Payment method:* razorpay\n- *Date:* ${new Date().toLocaleString()}`,
      };
      await axios.post(SLACK_PAYMENT_HOOK_URL, slackMessage);
    } catch (error) {}

    res.status(201).json({ success: true, data: payload });
  } catch (error) {
    // Log error for debugging
    saveErrorLog(err.message, "high", {}, "Razorpay payment", req.user.email);
    res.status(500).json({ error: error.message });
  }
};

const razorpayCallback = async (req, res) => {
  try {
    const endpointSecret = process.env.RAZOR_WEBHOOK_SECRET;

    if (!endpointSecret) {
      throw new Error("Payment validation failed: Missing webhook secret.");
    }

    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      throw new Error("Payment validation failed: Missing signature header.");
    }

    // Compute the HMAC SHA256 signature
    const hmac = crypto.createHmac("sha256", endpointSecret);
    hmac.update(req.body.toString()); // Ensure the raw body is used for signature computation
    const computedSignature = hmac.digest("hex");

    // Validate the signature
    if (computedSignature !== signature) {
      throw new Error("Signature verification failed.");
    }

    // Parse the event
    const event = JSON.parse(req.body.toString());
    const email = event.payload?.payment?.entity?.email;
    req.email = email;

    // Handle events
    if (event.event === "order.paid") {
      const metadata = event.payload.order.entity.notes;
      const { transactionId, type, userId, package, amount } = metadata;
      await updateTransaction(transactionId, type, userId, package);

      try {
        // Send a notification to Slack;
        const SLACK_PAYMENT_HOOK_URL = process.env.SLACK_PAYMENT_HOOK_URL;
        const slackMessage = {
          text: `*Payment received:*\n- *User:* ${
            req.email
          }\n- *Transaction Id:* ${transactionId}\n- *Amount:* ${amount}\n- *Package:* ${type}\n- *Plan:* ${package}\n- *Status:* success\n- *Payment method:* razorpay\n- *Date:* ${new Date().toLocaleString()}`,
        };
        await axios.post(SLACK_PAYMENT_HOOK_URL, slackMessage);
      } catch (error) {}

      return res
        .status(200)
        .send({ success: true, message: "Payment successful" });
    } else {
      throw { message: "Event received but not handled" };
    }
  } catch (err) {
    console.log(err);
    // Log error for debugging
    saveErrorLog(err.message, "high", {}, "Razorpay payment", req.email);
    return res.status(400).send({ success: false, message: err.message });
  }
};

module.exports = {
  // Bkash Payment
  bkashCheckout,
  bkashCallback,
  search,
  refund,
  refundStatus,

  // Stripe Payment
  stripeCheckout,
  stripeCallback,

  //Razonpay payment
  razonpayCheckout,
  razorpayCallback,
};
