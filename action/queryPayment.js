
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const authHeaders = require("../action/authHeader.js");
const { bkashConfig } = require('../config/bkashConfig.js');

const queryPayment = async (paymentID) => {
  const queryResponse = await fetch(bkashConfig.query_payment_url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      paymentID,
    }),
  });
  const queryResult = await queryResponse.json();
  return queryResult;
};

module.exports = queryPayment;
