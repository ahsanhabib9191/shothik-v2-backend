const { getOpenAIAPIConfiguration } = require("..");
const { admin, OpenAIApi } = require("../../lib/lib");
var colors = require('colors');

const text = "They provide shelter, serve as centers of commerce and culture, and serve as anchors of identity for generations to come.⁤"


async function getOpenAIAPI(){
    const configuration = await getOpenAIAPIConfiguration();
    const openai = new OpenAIApi(configuration);
    return {
        openai
    }
}


// split the text for each sentence;

const splitText = (text="") => {
   
    const sentences = text.split(".");

    const lines = sentences.filter(line => String(line).replace(' ', '') !== "").map(line => line.trim());

    var datas = [];
    for(let line of lines){
        if(line !=='' && line.length > 5){
            datas.push(line);
        }
    }

    return datas
}


async function getSentanceWithModification(lines){

    const  {  openai  } = await getOpenAIAPI();

    var requests = [];
    for(let line of lines){
        const prompt = getPromt(line);



        const reqPayload = openai.createChatCompletion({
            model: "gpt-4",
            messages: [{
              role: "user",
              content: prompt,
            }],
          });

        requests.push(reqPayload);
    }

    const responses = await Promise.all(requests);
    let index = 0;

    let finalText = "";

    for(let response of responses){
        const line = lines[index];
        const content = modifyLine(response.data.choices[0].message.content, line);
        console.log('Previous : ', line.red.underline.bold);
        console.log('Currrent : ', content.green.underline.bold);
        finalText += `${content}. `;
    }

    console.log(finalText.cyan.underline.bold);


}

// getSentanceWithModification(splitText(text)); // start humanization



// ===========================================================================
// ===========================================================================


function getPromt(line){

    const promt = `tokenize the given line find parts of speech for every token, and phrase , and give output in this Pure JSON format. and if the token is a verb and adjective then add a synonym object with 3 synonyms with the token object .The output should include the maximum number of phrases in the JSON format.

    {
      "phrases": [
        {
          "phrase": "Computers are incredible machines",
          "type": "noun_phrase",
          "changeable": [
            {
            "phrase": "Laptops are remarkable devices", 
            "type": "noun_phrase",
            "tokens": [
                {
                    "token": "Laptops", 
                    "name": "noun", 
                    "synonyms": ["laptop", "computer", "device"]
                },
                 ...other tokens
              ]
            },
            ...other changeable phrases
          ]
        },
        ...other phrases
      ],
    }
given line 
'${line}'.`

return promt;


}


function modifyLine(data, originalLine) {
    try {
        var modifiedLine = originalLine;

        const jsonData = JSON.parse(data);

        // console.log(jsonData)
        
        // Modify noun phrases
        jsonData.phrases.forEach(phraseObj => {
        if (
            phraseObj.type === "noun_phrase" || 
            phraseObj.type === "prepositional_phrase" || 
            phraseObj.type === "verb_phrase" || 
            phraseObj.type === "adjective_phrase" || 
            phraseObj.type === "adverb_phrase" || 
            phraseObj.type === "noun_clause" || 
            phraseObj.type === "relative_clause"
        ) {
                phraseObj.changeable.forEach(changeablePhrase => {
                // console.log('Changable', changeablePhrase)
                modifiedLine = modifiedLine.replace(phraseObj.phrase, changeablePhrase.phrase);

                for(let token of changeablePhrase.tokens){
                    const tknNme = token?.name;
                    const tkn = token?.token;
                    const synmns = token?.synonyms
                    if(tknNme === "verb" || tknNme === "adjective"){
                        // console.log(String(tkn).bgRed.white,synmns);

                        // Implementing grammer logics
                        if(tknNme === "adjective" && synmns?.length > 0){
                            modifiedLine = String(modifiedLine).replace(tkn, synmns[rndN(0,synmns.length-1)]);
                        }

                        if(tknNme === "verb" && synmns?.length > 0){
                            modifiedLine = String(modifiedLine).replace(tkn, synmns[rndN(0,synmns.length-1)]);
                        }

                        // if(tknNme === "noun" && synmns?.length > 0){
                        //     modifiedLine = String(modifiedLine).replace(tkn, synmns[rndN(0,synmns.length-1)]);
                        // }


                    }
                }
                
            });
        }
        });
        
        return modifiedLine;

    } catch (error) {
        return "";
    }    
}




function rndN(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  



























  
//   // Example usage
//   const jsonData = {
//     "phrases": [
//     {
//     "phrase": "checking emails",
//     "type": "verb_phrase",
//     "changeable": [
//     {"phrase": "reading messages", "type": "verb_phrase"},
//     {"phrase": "responding to correspondence", "type": "verb_phrase"}
//     ]
//     },
//     {
//     "phrase": "browsing social media",
//     "type": "verb_phrase",
//     "changeable": [
//     {"phrase": "scrolling through feeds", "type": "verb_phrase"},
//     {"phrase": "engaging with online communities", "type": "verb_phrase"}
//     ]
//     },
//     {
//     "phrase": "crunching numbers",
//     "type": "verb_phrase",
//     "changeable": [
//     {"phrase": "analyzing data", "type": "verb_phrase"},
//     {"phrase": "performing calculations", "type": "verb_phrase"}
//     ]
//     },
//     {
//     "phrase": "for work or school",
//     "type": "prepositional_phrase",
//     "changeable": [
//     {"phrase": "in professional or educational settings", "type": "prepositional_phrase"},
//     {"phrase": "to support career or academic pursuits", "type": "prepositional_phrase"}
//     ]
//     }
//     ],
//     "tokens": [
//     {"token": "Whether", "name": "conjunction"},
//     {"token": "you're", "name": "pronoun"},
//     {"token": "checking", "name": "verb", "synonyms": ["verifying", "inspecting", "examining"]},
//     {"token": "emails", "name": "noun"},
//     {"token": "browsing", "name": "verb", "synonyms": ["perusing", "scanning", "skimming"]},
//     {"token": "social", "name": "adjective", "synonyms": ["communal", "collective", "interpersonal"]},
//     {"token": "media", "name": "noun"},
//     {"token": "or", "name": "conjunction"},
//     {"token": "crunching", "name": "verb", "synonyms": ["processing", "analyzing", "calculating"]},
//     {"token": "numbers", "name": "noun"},
//     {"token": "for", "name": "preposition"},
//     {"token": "work", "name": "noun"},
//     {"token": "or", "name": "conjunction"},
//     {"token": "school", "name": "noun"},
//     {"token": "computers", "name": "noun"},
//     {"token": "are", "name": "verb"},
//     {"token": "there", "name": "adverb"},
//     {"token": "to", "name": "preposition"},
//     {"token": "help", "name": "verb", "synonyms": ["assist", "aid", "support"]},
//     {"token": "us", "name": "pronoun"},
//     {"token": "accomplish", "name": "verb", "synonyms": ["achieve", "complete", "fulfill"]},
//     {"token": "tasks", "name": "noun"},
//     {"token": "more", "name": "adverb"},
//     {"token": "efficiently", "name": "adverb"}
//     ]
//     }
  
//   const originalLine = "Whether you're checking emails, browsing social media, or crunching numbers for work or school, computers are there to help us accomplish tasks more efficiently.";
  
//   console.log(modifyLine(jsonData, originalLine));
  