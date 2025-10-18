const path = require("path");
const { GenerateSampleText } = require("../mongo/models/generateSampleText");
const { generativeModel } = require("../vertext/vertext");

const GenerateSampleTextController = async (req, res) => {
  try {
    const { language = "english" } = req.body;

    // Use aggregation to get a sample text in the specified language
    let dbResult = await GenerateSampleText.aggregate([
      { $match: { language: language } },
      { $sample: { size: 1 } },
    ]);

    if (dbResult && dbResult.length > 0) {
      // Set cache control header
      res.setHeader("Cache-Control", "max-age=31536000");

      // Respond with the sample text
      return res.json({ content: dbResult[0].text });
    }

    // If no sample text was found at all, generate new text
    const result = await generateText(language);
    return res.json({ content: result });

    // res.json({ message: "Sample text generated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "SERVER_ERROR", message: "Internal server error" });
  }
};

async function generateText(language) {
  const prompt = {
    text: `Generate a random ${language} sample text within 2 to 3 lines of sentences on any real-life events.`,
  };
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
      __dirname,
      "..",
      "cred",
      "service_account.json"
    );

    const sendReq = {
      contents: [{ role: "user", parts: [prompt] }],
    };

    // Call Gemini API to generate content stream
    const streamingResp = await generativeModel.generateContentStream(sendReq);

    let result = "";
    for await (const item of streamingResp?.stream) {
      const parsedResponse = JSON.parse(JSON.stringify(item));
      for (let content of parsedResponse?.candidates) {
        for (let parts of content.content.parts) {
          const text = parts?.text;
          result += text;
        }
      }
    }

    // Save the generated sample text to the database
    await new GenerateSampleText({
      text: result,
      language,
    }).save();

    // Return the generated output
    return result;
  } catch (error) {
    console.error("Error generating text with Gemini:", error.message);
    throw new Error("Error generating text");
  }
}

// async function generateText(language){
//         const configuration = await getOpenAIAPIConfiguration();
//         const openai = new OpenAIApi(configuration);

//         const completion = await openai.createChatCompletion({
//           model: "gpt-4",
//           messages: [{
//             role: "user",
//             content: `Generate a random ${language} sample text within 2 to 3 lines of sentences on any real life events.`,
//           }],
//         });

//         const result = completion.data.choices[0].message.content;

//         await new GenerateSampleText({
//           text: result,
//           language
//         }).save();

//         // Return output
//       return result;
// }

// export
module.exports = {
  GenerateSampleTextController,
};
