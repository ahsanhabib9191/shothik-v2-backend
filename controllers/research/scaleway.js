import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.scaleway.ai/be5fb5ae-5dba-4ed9-957d-a1b0ea461777/v1",
  apiKey: "SCW_SECRET_KEY" // Replace SCW_SECRET_KEY with your IAM API key
});

async function complete_request(prompt) {
  const stream = await client.chat.completions.create({
    model:"llama-3.1-70b-instruct",
    messages: [
      { "role": "system", "content": "You are a helpful assistant" },
      { "role": "user", "content": prompt },
    ],
    max_tokens: 512,
    temperature: 0.7,
    top_p: 0.7,
    presence_penalty: 0,
    stream: true,
  });

  let responseText = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    responseText += content;
    process.stdout.write(content);
  }
  return responseText;
}

module.exports = {
  complete_request
};
