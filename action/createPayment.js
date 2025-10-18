const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const { v4: uuidv4 } = require("uuid");
const authHeaders = require("../action/authHeader.js");
const { log } = require("../lib/log");
const { bkashConfig } = require("../config/bkashConfig.js");
const { Transection } = require("../mongo/models/UserTransection.js");
const { Moment } = require("../lib/moment.js");
const { default: axios } = require("axios");

const createPayment = async (req) => {
  try {
    if (!req.amount || req.amount < 1) {
      throw { message: "minimum amount Atlest 1 tk" };
    }

    const user = req.user;

    const validTil = new Date();
    // if month then add 30 days with validTil
    if (req.payment_type === "monthly") {
      validTil.setMonth(validTil.getMonth() + 1);
    }
    // if year then add 365 days with validTil
    if (req.payment_type === "yearly") {
      validTil.setFullYear(validTil.getFullYear() + 1);
    }

    // create a transection of user payment
    const transaction = await new Transection({
      userId: user._id,
      amount: req.amount,
      package: req?.package,
      plan: req?.payment_type,
      paymentMethod: "bkash",
      status: "pending",
      _date: Moment(),
      validTil,
    }).save();

    const trnx_id = transaction._id;
    const callBack = `${bkashConfig.backend_callback_url}?tranx_id=${trnx_id}&user_id=${user._id}&type=${req.payment_type}&package=${req?.package}`;

    
    const createResopnse = await fetch(bkashConfig.create_payment_url, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        mode: "0011",
        payerReference: `${trnx_id}`,
        callbackURL: callBack,
        amount: req.amount,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: "Inv" + uuidv4().substring(0, 5),
      }),
    });

    const createResult = await createResopnse.json();

    try {
      const SLACK_PAYMENT_HOOK_URL = process.env.SLACK_PAYMENT_HOOK_URL;
      // // Send a notification to Slack;
      const slackMessage = {
        text: `*Payment transaction:*\n- *User:* ${
          req.user.email
        }\n- *Transaction Id:* ${transaction._id.toString()}\n- *Amount:* ${
          req.amount
        }\n- *Package:* ${req?.package}\n- *Plan:* ${
          req?.payment_type
        }\n- *Status:* pending\n- *Payment method:* bkash\n- *Date:* ${new Date().toLocaleString()}`,
      };
      await axios.post(SLACK_PAYMENT_HOOK_URL, slackMessage);
    } catch (error) {}

    return createResult;
  } catch (error) {
    throw error;
  }
};

const createPaymentForRider = async (req, { amount, rider_id }) => {
  try {
    if (!amount || amount < 1) {
      return "minimum amount Atlest 1 tk";
    }

    const riderCallback = String(bkashConfig.backend_callback_url).replace(
      "callback",
      "rider-payment-callback"
    );

    const createResopnse = await fetch(bkashConfig.create_payment_url, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        mode: "0011",
        payerReference: `${req?.order_id}`,
        callbackURL: `${riderCallback}?rider_id=${rider_id}`,
        amount: amount,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: "Inv" + uuidv4().substring(0, 5),
      }),
    });
    const createResult = await createResopnse.json();

    return createResult;
  } catch (e) {
    log(e);
  }
};

module.exports = {
  createPayment,
  createPaymentForRider,
};
