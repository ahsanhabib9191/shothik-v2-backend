
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const authHeaders = require("../action/authHeader.js");
const { bkashConfig } = require('../config/bkashConfig.js');

const refundTransaction = async (body_data) => {
  const refundResponse = await fetch(bkashConfig.refund_transaction_url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body_data),
  });
  const refundResult = await refundResponse.json();
  return refundResult;
};

module.exports = refundTransaction;
