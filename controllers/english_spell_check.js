const { default: axios } = require("axios");
const { getAccessToken } = require("../cred/accessToken");
const { API_ENDPOINT, PROJECT_ID, LOCATION_ID, MODEL_ID, generation_config } = require("../vertext/vertext");
const { PackagePermission } = require("../lib/PackagePermission");
const { TrackUsage } = require("../lib/TrackUsage");
const { permission } = require("../permissions/permission");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");

async function englishSpellChecker(req, res) {
    const { data } = req.body;
    if(!data){
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid request' });
    }

    try {
      
      const requestPayload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": `find the wrong word and give just a javascript array of the wrong words like ['word1', 'word2'] \n "${data}"`
                    }
                ]
            }
        ],
        "generation_config": generation_config,
        "safetySettings": []
    };
    
    
        const token = await getAccessToken();
        const { data:response }= await axios.post(`https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:streamGenerateContent`, requestPayload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
  
        var output = "";
        for(let content of response){
          for(let each of content?.candidates){
            for(let part of each?.content?.parts){
              output += part.text;
            }
          } 
        }

        if (typeof output === 'string') {
            output = output.replace(/'/g, '"');
            output = JSON.parse(output); // Convert string to array
        }

        return res.json({ content: output });
    } catch (error) {
      console.log(error);
      saveErrorLog(error.message, 'high', data, 'english_spell_check');
      return res.json({ content: [] })
    }
  
  };



  async function fixEnglishGrammerWithVerText(req, res) {
    const { data } = req.body;
    if(!data){
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid request' });
    }

     // ========== Check useage api hit and word limit permission========
    const {todayApiUsed, apiLimit, wordLimit} = await PackagePermission(req.id, req.userIp, req.browserAgent, req.package, 'english_grammer')
    if(req.user){
      // check api limit 
      if(todayApiUsed >= apiLimit){
        return res.status(429).json({ success: false, message: "English Grammer limit exceeded", error: 'LIMIT_REQUEST'});
      }
      // check word limit 
      if((String(data)?.split(' ')?.length) > wordLimit){
        return res.status(429).json({ success: false, message: `You can't use more than ${wordLimit} word`,  error: 'LIMIT_REQUEST'});
      }
    }else{
      // check api limit 
      if(todayApiUsed >= permission.without_login.paraphrase.api){
        return res.status(429).json({ success: false, message: "English Grammer limit exceeded" , error: 'LIMIT_REQUEST'});
      }
      // check word limit 
      if((String(data)?.split(' ')?.length) >= permission.without_login.paraphrase.word){
        return res.status(429).json({ success: false, message: "You can't use more than 100 word",  error: 'LIMIT_REQUEST'});
      }
      
    }

    // save Usage
    TrackUsage(req, {
      service:"english_grammer",
      word_count: String(data).split(' ').length,
    })
  
    try {
      const requestPayload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": `correct the English grammar , do not include any extra word like '## Corrections Made:' or '## Corrected Sentence is: ' \n given text : "${data}"`
                    }
                ]
            }
        ],
        "generation_config": generation_config,
        "safetySettings": []
    };
    
        const token = await getAccessToken();
        const { data:response }= await axios.post(`https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/${LOCATION_ID}/publishers/google/models/${MODEL_ID}:streamGenerateContent`, requestPayload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
  
        var output = "";
        for(let content of response){
          for(let each of content?.candidates){
            for(let part of each?.content?.parts){
              output += part.text;
            }
          } 
        }
  
      return res.json({ content: output });
  
    } catch (error) {
      saveErrorLog(error.message, 'high', data, 'english_spell_check');
      console.log(error);
    }
  
  };

  module.exports = {
    englishSpellChecker,
    fixEnglishGrammerWithVerText
  }