const { getOpenAIAPIConfiguration } = require(".");
const { admin, OpenAIApi } = require("../lib/lib");


const contentWriterController = async (req, res) => {
    try {
        // Extract necessary data from the request
        const data = req.body;
    
          const configuration = await getOpenAIAPIConfiguration();
          const openai = new OpenAIApi(configuration);
  
          const docRef = admin.firestore().collection("templates").doc(data.id);
          const doc = await docRef.get();
  
          const { prompt } = doc.data();
  
          const formattedPrompt = prompt.replace(/\\n/g, "\n");
  
          const replacedPrompt = formattedPrompt.replace(/\[(.*?)\]/g, (match, placeholder) => {
            const value = data[placeholder.trim()];
            return value || match;
          });
  
          const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{
              role: "user",
              content: replacedPrompt,
            }],
          });
  
          // Return output
          return res.json({ content: completion.data.choices[0].message.content });
        
    
        res.json({ message: 'Content writer request processed successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Internal server error' });
      }
}

module.exports = { contentWriterController };