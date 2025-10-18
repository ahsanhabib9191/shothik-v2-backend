

const axios = require('axios');
const { allowCors } = require('../lib/allowCors');


async function banglaSpealChecker(req ,res){
    try {

      var { content } = req.body;
        
        content = String(content).trim();
        
        const { data }  =await axios.post("https://api.spellcheck.bangla.gov.bd/checking", {
                service: "spell",
                content: content??".",
                maxSuggestionCount: 10,
                permissionToStoreData: true,
                client: 17,
                appVersion: "1.0.2",
                apiVersion: "2.1",
                userStoredData: {
                  addToDictionaryTokens: [],
                  ignoreAllTokens: [],
                  ignoreOnceTokens: []
                }
              }, {
                headers: {
                  "accept": "application/json, text/plain, */*",
                  "accept-language": "en-US,en;q=0.9",
                  "cache-control": "no-cache",
                  "content-type": "application/json",
                  "pragma": "no-cache",
                  "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
                  "sec-ch-ua-mobile": "?0",
                  "sec-ch-ua-platform": "\"Windows\"",
                  "sec-fetch-dest": "empty",
                  "sec-fetch-mode": "cors",
                  "sec-fetch-site": "same-site",
                  "Referer": "https://spell.bangla.gov.bd/",
                  "Referrer-Policy": "strict-origin-when-cross-origin"
                }
              });

        // console.log(data);

        return res.json({ result: data })

    } catch (error) {
        console.log("Error Occured", error);
    }
}

module.exports = { banglaSpealChecker: allowCors(banglaSpealChecker) }