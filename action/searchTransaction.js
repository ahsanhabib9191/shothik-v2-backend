
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const authHeaders = require("../action/authHeader.js");
const { bkashConfig } = require('../config/bkashConfig.js');

const searchTransaction = async (trxID) => {
  const searchResponse = await fetch(bkashConfig.search_transaction_url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      trxID,
    }),
  });
  const searchResult = await searchResponse.json();
  return searchResult;
};

module.exports = searchTransaction;
