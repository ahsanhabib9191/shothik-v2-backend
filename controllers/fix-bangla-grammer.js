const { getOpenAIAPIConfiguration } = require(".");
const { getAccessToken } = require("../cred/accessToken");
const { OpenAIApi } = require("../lib/lib");
const { generativeModel, generation_config, API_ENDPOINT, PROJECT_ID, MODEL_ID, LOCATION_ID } = require("../vertext/vertext");
const axios = require('axios');

const { GoogleAuth } = require('google-auth-library');
const { generateContent } = require("../vertext/vertext2");
const { PackagePermission } = require("../lib/PackagePermission");
const { TrackUsage } = require("../lib/TrackUsage");
const { permission } = require("../permissions/permission");

const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform',
});


const FixBanglaGrammerController = async (req, res) => {
    try {
        // Extract necessary data from the request
        const { data } = req.body;

        if(!data){
            return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid request' });
        }
    
          const configuration = await getOpenAIAPIConfiguration();
          const openai = new OpenAIApi(configuration);

          const promt = `fix grammar correction and fix Bangla word if any word wrong "${data}"`
          
          const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{
              role: "user",
              content: promt,
            }],
          });
  
          // Return output
          return res.json({ content: completion.data.choices[0].message.content });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error' });
      }
}


async function fixBanglaGrammerWithVerText(req, res) {
  const { data, mode, synonym } = req.body;
  const userEmail = req?.user?.email || '';
  if(!data){
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid request' });
  }

  // ========== Check useage api hit and word limit permission========
  const {todayApiUsed, apiLimit, wordLimit} = await PackagePermission(req.id, req.userIp, req.browserAgent, req.package, 'bangla_grammer')
    if(req.user){
      // check api limit 
      if(todayApiUsed >= apiLimit){
        return res.status(429).json({ success: false, message: "API call limit exceeded", error: 'LIMIT_REQUEST'});
      }
      // check word limit 
      if((String(data)?.split(' ')?.length) > wordLimit){
        return res.status(429).json({ success: false, message: `You can't use more than ${wordLimit} word`,  error: 'LIMIT_REQUEST'});
      }
    }else{
      // check api limit 
      if(todayApiUsed >= permission.without_login.bangla_grammer.api){
        return res.status(429).json({ success: false, message: "API call limit exceeded" , error: 'LIMIT_REQUEST'});
      }
      // check word limit 
      if((String(data)?.split(' ')?.length) >= permission.without_login.bangla_grammer.word){
        return res.status(429).json({ success: false, message: "You can't use more than 100 word",  error: 'LIMIT_REQUEST'});
      }
      
    }

    // save Usage
      TrackUsage(req, {
      service:"bangla_grammer",
      word_count: String(data).split(' ').length,
    })

  var promt = `fix and correct the Bengali grammar and sentence, just focus in grammer and sentence correction `;
  if(mode && mode !==""){
    promt += `${promt} in ${mode} mode `
  }


  if(synonym && synonym !==""){
    promt += `${promt}  and keep  ${synonym} lavel of synonym `
  }

  try {
    
    const requestPayload = {
      "contents": [
          {
              "role": "user",
              "parts": [
                  {
                      "text": `${promt} "${data}"`
                  }
              ]
          }
      ],
      "generation_config": generation_config,
      "safetySettings": []
  };
  
  // fs.writeFileSync('request.json', JSON.stringify(requestPayload));
  
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
          if(each?.content?.parts){
            for(let part of each?.content?.parts){
              output += part.text;
            }
          }
        } 
      }

    return res.json({ content: output });

  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, 'high', {}, 'bangla_grammer', userEmail);
  }

};


// fix bangla grammer 
async function fixBanglaGrammerWithVerTextV2(req, res){

  try {
    
  const { content } = req.body;

  await generateContent(content);

  return;

  // console.log('Working...');
  // // process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, "..","cred", 'service_account.json');

  // const payload = {
  //   contents: [{role: 'user', parts: [{text: `format and check grammer  correct sentence in Bangla. Abstract: ${content}.
  //   `}]}],
  // };

  // const streamingResp = await generativeModel.generateContentStream(payload);

  // for await (const item of streamingResp?.stream) {
  //   var parsedResponse = JSON.parse(JSON.stringify(item));
  //   for(let content of parsedResponse?.candidates){
  //       for(let parts of content.content.parts){
  //           // sendMessage('test', 'test', { data: parts?.text });
  //           process.stdout.write('=> ' + parts?.text);
  //       }
  //   }
  // }
  } catch (error) {
    console.log(error);
  }
  //   const data = await streamingResp.response;
  // return "data";

  // res.json({ content: "" });

}


module.exports = { 
  FixBanglaGrammerController, 
  fixBanglaGrammerWithVerText , 
  fixBanglaGrammerWithVerTextV2
};