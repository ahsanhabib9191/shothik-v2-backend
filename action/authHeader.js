
const { bkashConfig } = require("../config/bkashConfig.js");
const grantToken = require("./../action/grantToken.js");


const authHeaders = async () => {  
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    authorization: await grantToken(),
    "x-app-key": bkashConfig?.app_key,
  };
};

module.exports = authHeaders;
