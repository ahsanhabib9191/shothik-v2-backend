const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { bkashConfig } = require("../config/bkashConfig");

const tokenHeaders = require("./tokenHeaders.js");
const { log } = require("../lib/log");

const grantToken = async () => {
  try {
    const tokenResponse = await fetch(bkashConfig?.grant_token_url, {
      method: "POST",
      headers: tokenHeaders(),
      body: JSON.stringify({
        app_key: bkashConfig?.app_key,
        app_secret: bkashConfig?.app_secret,
      }),
    });
    const tokenResult = await tokenResponse.json();

    // globaDataSet(tokenResult);
    return tokenResult?.id_token;

    // return tokenResult;
  } catch (e) {
    log(e);
  }
};

module.exports = grantToken;
