const authHeaders = require("../action/authHeader.js");
const { bkashConfig } = require("../config/bkashConfig.js");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const executePayment = async (paymentID) => {
  const executeResponse = await fetch(bkashConfig.execute_payment_url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      paymentID,
    }),
  });

  const executeResult = await executeResponse.json();
  return executeResult;
};

module.exports = executePayment;
