const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
// const serviceAccount = require("./shothikai-gcp-firebase-adminsdk-xynej-8c42f68e6c.json"); // previously used this but now it's not working
const serviceAccount = require("./service-account.json"); // this works
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});



// export 
module.exports = {
  admin,
  axios,
  Configuration,
  OpenAIApi,
  functions
}