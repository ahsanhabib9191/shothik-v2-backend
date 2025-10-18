// const globals = require("node-global-storage");
// const grantToken = require("../action/grantToken.js");
// const { log } = require("../lib/log.js");

const authCheck = async (req, res, next) => {
  // call grant token always
  // await grantToken();

  next();
};


module.exports = authCheck;