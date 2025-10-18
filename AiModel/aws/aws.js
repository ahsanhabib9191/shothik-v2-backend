require("dotenv").config(); // Load environment variables

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const region = "us-east-1";
const accessKeyId = "AKIAQ3EGPYPIDAAKR7PD";
const secretAccessKey = "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";
const modelId = "amazon.nova-lite-v1:0";

const client = new BedrockRuntimeClient({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const AskAwsAI = async (propmt) => {
  try {
    const body = JSON.stringify({
      messages: [
        {
          role: "user",
          content: [{ text: propmt }],
        },
      ],
    });

    const params = {
      modelId,
      body,
      accept: "application/json",
      contentType: "application/json",
    };

    const command = new InvokeModelCommand(params);
    const response = await client.send(command);

    const responseBody = response.body.transformToString();
    const data = JSON.parse(responseBody);
    const result = data.output.message.content[0].text;

    return result;
  } catch (err) {
    console.error("Error invoking model:", err);
    throw {
      error: "model_error",
      message:
        "The server is currently unable to handle your request. Please try again later.",
    };
  }
};

module.exports = { AskAwsAI };
