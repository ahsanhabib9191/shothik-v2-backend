// Bkash Config File
const bkashJSON_prod = require("./bkashConfig.prod.json");
const bkashJSON_dev = require("./bkashConfig.dev.json");

// exports
module.exports = {
  bkashConfig:
    process.env.NODE_ENV === "development" ? bkashJSON_dev : bkashJSON_prod,
  // bkashConfig: bkashJSON_prod,
};
