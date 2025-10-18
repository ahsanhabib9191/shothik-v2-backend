

const axios  =  require('axios');
const { HumanizeContent } = require('../../mongo/models/HumanizeText');

const { getOpenAIAPIConfiguration } = require("..");
const { admin, OpenAIApi } = require("../../lib/lib");
const { formatStringArray } = require("../../lib/helper");
const { AIDectedWords } = require('../../data/AIDetectedWords');

const humanizerController = async (req, res) => {

    const text = req.body.text;

    try {

      const configuration = await getOpenAIAPIConfiguration();
      const openai = new OpenAIApi(configuration);


         
      let request = [];
      let arr = String(text).split('.').filter(x => x.length > 0);

      var modes = ['Simple', 'Formal', "Fluency"]


      const gptModel = "gpt-4";
      let modesSerial = 0;
      for(let each of arr){

        // every time increase modes length
        modes = [...modes, 'Simple', 'Formal', "Fluency"];
        

        const prompt = `add some subjective verb error, include phrase error , punctuation error, verb tense inconsistency vocabulary repetition  but maintain a  contextually appropriate manner use more varied vocabulary here is a sample you can learn form :

        "Awareness is beginning to creep in about building differences it seems while the inquiry proceeds. This extraordinary discovery heralds a great opportunity of remodeling them in a completely different way, and it may lead to the comprehensive exploration of evolutionary patterns within their habitats.Researcher are currently making arrangements for expeditions to uncover more about this remarkable discovery."
        
        now intentionally make error  but maintain a contextually appropriate manner now . Paraphrase the following content in ${modes[modesSerial]} mode with basic level synonyms and give at least 3 paraphrase and output format will be 
        ["paraphrase 1", "paraphrase 2", "paraphrase 3"] \n given text is : "${each}"`


        modesSerial++;

        
      const completion = openai.createChatCompletion({
          model: gptModel,
          messages: [{
            role: "user",
            content: prompt,
          }],
        });

        request.push(completion);
      }


      let dta = [];
      const responses = await Promise.all(request);

      var humanize = "";

      for(let r of responses){
        try {
          const a = formatStringArray(r.data.choices[0].message.content);
          dta.push(a);

          if(a.length > 0){
            if(req.query.variant=2){
              const modifiedLine = changeDetectedWord(a[1]);
              humanize += modifiedLine;
            }else if(req.query.variant=3){
              const modifiedLine = changeDetectedWord(a[2]);
              humanize += modifiedLine;
            }else{
              const modifiedLine = changeDetectedWord(a[0]);
              humanize += modifiedLine;
            }
          }
         
        } catch (error) {
          
        }
      }

      var data = [];

      const variations = [0,1,2];

      for(let variant of variations){
        let content = "";
        for(let each of dta){
          content += `${each[variant]} `;
        }

        data.push(`${content}.`);
      }
      
      return res.json({
        data
      })


    } catch (error) {
      console.log(error)
        return res.status(429).json(error);
    }

}

module.exports = {
    humanizerController
}

async function storeInDB(data){
    try {
        await HumanizeContent.insertMany(data.sentences);
        const count = await HumanizeContent.countDocuments();
        console.log("Total Count", count);
    } catch (error) {
        
    }
}



// replaced ai dectected words

function changeDetectedWord(line) {
  // Split the line into words
  const words = line.split(" ");

  // Iterate through each word
  const replacedLine = words.map(word => {
    // Check if the word exists in the synonyms object
    if (AIDectedWords[word.toLowerCase()]) {
      // Replace the word with a random synonym from the AIDectedWords array
      const randomIndex = Math.floor(Math.random() * AIDectedWords[word.toLowerCase()].length);
      return AIDectedWords[word.toLowerCase()][randomIndex];
    } else {
      // Keep the word unchanged if no synonym is found
      return word;
    }
  });

  // Join the words back into a line
  return replacedLine.join(" ");
}
