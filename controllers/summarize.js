const { admin } = require("../lib/lib");
const { PackagePermission } = require("../lib/PackagePermission");
const { TrackUsage } = require("../lib/TrackUsage");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const { saveUsagesLogs } = require("../mongo/models/UsageLogs");
const { permission } = require("../permissions/permission");
const { containsMaliciousText } = require("../lib/maliciousText");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { modelRroute } = require("../AiModel/confiq");

const summarizerKeywordsController = async (req, res) => {
  try {
    const { text } = req.body;

    const prompt = `
      You are a precise, multilingual keyword extraction assistant.  
      Detect the language of the provided text automatically.  
      Extract only the most meaningful and relevant keywords **that actually appear within the text**, without translation or language switching.  
      Do not add or infer any external or generic terms.  
      Return only distinct words or short phrases that best capture the key ideas or entities in the text.  
      The number of keywords should be flexible — include only as many as are meaningful based on the content (fewer if short).  
      Keep the output language exactly the same as the input text.  
      Output should be a **raw JSON array only**, with no markdown, code block, or explanation.

      Text:
      "${text}"

      Output format (strict JSON array):
      ["keyword1", "keyword2", "keyword3"]
    `;

    const data = await ShothikAIModel(prompt, modelRroute.summarize);

    const cleaned = data?.replace(/```json|```/g, "")?.trim();

    let parsed = [];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = [];
    }

    return res.json({ success: true, data: parsed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// const summarizerController = async (req, res) => {
//   const userEmail = req?.user?.email || "";
//   const data = req.body;
//   try {
//     // Set SSE headers
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");

//     // Extract necessary data from the request
//     const { text, mode, length, keywords } = req.body;

//     if (!text || !mode || !length) {
//       throw {
//         error: "INVALID_ARGUMENT",
//         message: "Required fields not present",
//       };
//     }

//     // Check for malicious content in the paraphrased output
//     const isContainMalicious = containsMaliciousText(text);
//     if (isContainMalicious) {
//       throw {
//         error: "MALICIOUS_CONTENT",
//         message:
//           "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
//       };
//     }

//     // ========== Check usage API hit and word limit permission =========
//     const { wordLimit, todayWordUsed, totalWordLimit } =
//       await PackagePermission(
//         req.id,
//         req.userIp,
//         req.browserAgent,
//         req.package,
//         "summarize"
//       );

//     const inputWords = String(text)?.split(" ")?.length;
//     const totalUsed = todayWordUsed + inputWords;

//     if (totalUsed > totalWordLimit) {
//       if (totalWordLimit !== 99999) {
//         throw {
//           message: "Summarize limit exceeded",
//           error: "LIMIT_REQUEST",
//         };
//       }
//     }
//     // Check word limit for authenticated users
//     if (inputWords > wordLimit) {
//       throw {
//         message: `You can't use more than ${wordLimit} words`,
//         error: "LIMIT_REQUEST",
//       };
//     }

//     //========== Implement logic for summarize here =============

//     // const settingsRef = admin
//     //   .firestore()
//     //   .collection("settings")
//     //   .doc("summarize");
//     // const settingsDoc = await settingsRef.get();
//     // const settings = settingsDoc.data();
//     // const promptTemplate = settings.api.options.openai.modes.filter(
//     //   (item) => item.name === mode
//     // )[0].prompt;

//     // this above code is previously used and they depend on service account with firebase configuration which is not working now 👆👆

//     // This is the workaround version of it. 👇

//     const PROMPT_MODES_V1 = {
//       short:
//         "Summarize the following text in a very brief form, no more than [length] words. Focus only on the most essential information without extra details.\n\n[text]",

//       regular:
//         "Summarize the following text in about [length] words. Keep it clear, concise, and informative without losing key meaning.\n\n[text]",

//       medium:
//         "Summarize the following text in a moderately detailed way, around [length] words. Capture all main ideas with sufficient context, but avoid unnecessary explanations.\n\n[text]",

//       long: "Summarize the following text in a comprehensive way, up to [length] words. Include all major points and supporting details while keeping it structured and readable.\n\n[text]",
//     };

//     // V2 is failing to detect language when length is selected long

//     const PROMPT_MODES_V2 = {
//       short:
//         "Summarize the following text in the same language it is written. Keep the summary very brief, no more than [length] words. Focus only on the most essential information without extra details.\n\n[text]",

//       regular:
//         "Summarize the following text in the same language it is written, in about [length] words. Keep it clear, concise, and informative without losing key meaning.\n\n[text]",

//       medium:
//         "Summarize the following text in the same language it is written, around [length] words. Capture all main ideas with sufficient context, but avoid unnecessary explanations.\n\n[text]",

//       long: "Summarize the following text in the same language it is written, up to [length] words. Include all major points and supporting details while keeping it structured and readable.\n\n[text]",
//     };

//     const PROMPT_MODES_V3 = {
//       short: `CRITICAL INSTRUCTION: You must respond in the exact same language as the input text. Do not translate, convert, or change the language under any circumstances.

//     Summarize the following text in the same language it is written in, keeping it very brief, no more than [length] words. Focus only on the most essential information without extra details.

//     INPUT TEXT:
//     [text]

//     REMEMBER: Your summary must be in the exact same language as the input text above.`,

//       regular: `CRITICAL INSTRUCTION: You must respond in the exact same language as the input text. Do not translate, convert, or change the language under any circumstances.

//     Summarize the following text in the same language it is written in, in about [length] words. Keep it clear, concise, and informative without losing key meaning.

//     INPUT TEXT:
//     [text]

//     REMEMBER: Your summary must be in the exact same language as the input text above.`,

//       medium: `CRITICAL INSTRUCTION: You must respond in the exact same language as the input text. Do not translate, convert, or change the language under any circumstances.

//     Summarize the following text in the same language it is written in, around [length] words. Capture all main ideas with sufficient context, but avoid unnecessary explanations.

//     INPUT TEXT:
//     [text]

//     REMEMBER: Your summary must be in the exact same language as the input text above.`,

//       long: `CRITICAL INSTRUCTION: You must respond in the exact same language as the input text. Do not translate, convert, or change the language under any circumstances.

//     Summarize the following text in the same language it is written in, up to [length] words. Include all major points and supporting details while keeping it structured and readable.

//     INPUT TEXT:
//     [text]

//     REMEMBER: Your summary must be in the exact same language as the input text above. Do not provide any explanations in a different language.`,
//     };

//     const PROMPT_MODES_V4 = {
//       short:
//         "You are an expert at creating ultra-concise summaries. Your task is to distill the following text into its absolute core essence.\nRequirements:\n-Maximum [length] words\n-Extract ONLY the most critical information\n-Eliminate all redundancy and filler words\n-Focus on actionable insights or main conclusions\nText to summarize:\n[text]]\nREMEMBER: Your summary must be in the exact same language as the input text above.\nSummary:",

//       regular:
//         "You are a professional summarization specialist. Create a balanced summary that captures the essential meaning while remaining accessible.\nRequirements:\n-Target approximately [length] words\n-Include main arguments, key findings, or central themes\n-Maintain logical flow and coherence\n-Preserve important context and nuance\n-Use clear, professional language\nText to summarize:\n[text]\nREMEMBER: Your summary must be in the exact same language as the input text above.\nSummary:",

//       medium:
//         "You are an analytical summarizer tasked with creating a comprehensive yet focused summary. Balance detail with clarity.\nRequirements:\n-Target approximately [length] words\n-Cover all major points with supporting context\n-Include relevant examples, data, or evidence when mentioned\n-Organize information logically (chronologically, by importance, or by topic)\n-Explain relationships between different concepts or ideas\n-Maintain the original tone and intent\nText to summarize:\n[text]\nREMEMBER: Your summary must be in the exact same language as the input text above.\nSummary:",

//       long: "You are a thorough content analyst. Create a detailed summary that serves as a comprehensive reference while remaining well-organized and readable.\nRequirements:\n-Target approximately [length] words\n-Include all significant points, arguments, and supporting details\n-Preserve important quotes, statistics, or specific examples\n-Explain cause-and-effect relationships and implications\n-Include background context where necessary for understanding\n-Maintain academic or professional rigor as appropriate to the source\nText to summarize:\n[text]\nREMEMBER: Your summary must be in the exact same language as the input text above.\nDetailed Summary:",
//     };

//     const textWordLength = text?.split(" ")?.length || 0;

//     //  const lengthMap = {
//     //    short: (Math.floor((2 / 3) * textWordLength) || 0).toString(),
//     //    regular: (Math.floor((3 / 4) * textWordLength) || 0).toString(),
//     //    medium: (Math.floor((4 / 5) * textWordLength) || 0).toString(),
//     //    long: (Math.floor((5 / 6) * textWordLength) || 0).toString(),
//     //  };

//     const shortLength = Math.floor((1 / 2) * textWordLength) || 0;
//     const longLength = Math.floor((5 / 6) * textWordLength) || 0;
//     const distance = longLength - shortLength;
//     const regularLength = Math.floor(shortLength + (distance / 4) * 1) || 0;
//     const mediumLength = Math.floor(shortLength + (distance / 4) * 3) || 0;

//     const lengthMap = {
//       short: shortLength.toString(),
//       regular: regularLength.toString(),
//       medium: mediumLength.toString(),
//       long: longLength.toString(),
//     };

//     console.log("lengthMap:", lengthMap);

//     const promptTemplate = PROMPT_MODES_V4[length];

//     if (!promptTemplate) {
//       throw { error: "INVALID_MODE", message: `Unsupported mode: ${mode}` };
//     }

//     const prompt = promptTemplate
//       .replace("[text]", text)
//       .replace("[length]", lengthMap[length])
//       .replace(/\\n/g, "\n");

//     const finalPrompt = `${prompt}. Please do not  provide any further explanations and unwanted text.`;

//     const isStrem = true;
//     let output = "";
//     let tries = 0;

//     while (tries < 3) {
//       try {
//         const streamingResp = await ShothikAIModel(
//           finalPrompt,
//           modelRroute.summarize,
//           isStrem
//         );

//         // Stream data to the client
//         for await (const chunk of streamingResp.stream) {
//           const text = chunk.text();
//           output += text;
//           res.write(text);
//         }
//         break;
//       } catch (error) {
//         tries++;
//         if (tries >= 3) {
//           throw {
//             error: "MODEL_ERROR",
//             message: "To Many Request, Please try again later",
//           };
//         }
//       }
//     }

//     const content = {
//       before: text,
//       after: output,
//       mode,
//       length,
//     };

//     // Save usage
//     TrackUsage(req, {
//       service: "summarize",
//       word_count: String(text).split(" ").length,
//     });

//     if (req.user) {
//       saveUsagesLogs(req.id, data, content, content, "summarize");
//     }

//     res.end();
//   } catch (error) {
//     console.error(error);

//     // Log error for debugging
//     saveErrorLog(error.message, "high", data, "summarize", userEmail);

//     // Send a user-friendly error response if the response isn't already sent
//     const statusCode = error.status || 500;
//     const errorName = error.error || "unknown";
//     const message =
//       !error.message || error.message?.includes("VertexAI")
//         ? "The server is currently unable to handle your request. Please try again later."
//         : error.message;

//     res.status(statusCode).json({
//       error: errorName,
//       message,
//     });
//   }
// };

const summarizerController = async (req, res) => {
  const userEmail = req?.user?.email || "";
  const data = req.body;
  try {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Extract necessary data from the request
    const { text, mode, length, keywords } = req.body;

    console.log("Summarizer Controller");

    console.log(text, mode, length, keywords);

    if (!text || !mode || !length) {
      throw {
        error: "INVALID_ARGUMENT",
        message: "Required fields not present",
      };
    }

    // Check for malicious content in the paraphrased output
    const isContainMalicious = containsMaliciousText(text);
    if (isContainMalicious) {
      throw {
        error: "MALICIOUS_CONTENT",
        message:
          "Thank you for using SHOTHIK AI. I am SHOTHIK, Developed by SHOTHIK AI TEAM",
      };
    }

    // ========== Check usage API hit and word limit permission =========
    const { wordLimit, todayWordUsed, totalWordLimit } =
      await PackagePermission(
        req.id,
        req.userIp,
        req.browserAgent,
        req.package,
        "summarize"
      );

    const inputWords = String(text)?.split(" ")?.length;
    const totalUsed = todayWordUsed + inputWords;

    if (totalUsed > totalWordLimit) {
      if (totalWordLimit !== 99999) {
        throw {
          message: "Summarize limit exceeded",
          error: "LIMIT_REQUEST",
        };
      }
    }

    // Check word limit for authenticated users
    if (inputWords > wordLimit) {
      throw {
        message: `You can't use more than ${wordLimit} words`,
        error: "LIMIT_REQUEST",
      };
    }

    let keywordInstruction = "";
    if (Array.isArray(keywords) && keywords.length > 0) {
      keywordInstruction = `
        IMPORTANT:
        - The following keywords MUST be included in the summary at least once in a natural way:
        ${keywords?.map((k) => `- ${k}`).join("\n")}
        - Do not translate, modify, or omit these keywords.
        - Ensure the summary flows naturally while including these terms.
      `;
    }

    const PROMPT_MODES = {
      short: `
        You are an expert at creating ultra-concise summaries. 
        Your task is to distill the following text into its absolute core essence.
        Requirements:
        - Target approximately [length] words
        - Extract ONLY the most critical information
        - Eliminate redundancy and filler
        - Focus on actionable insights or main conclusions
        ${keywordInstruction}
        Text to summarize:
        [text]
        REMEMBER: Your summary must be in the exact same language as the input text above.
        Summary:
      `,

      regular: `
        You are a professional summarization specialist. 
        Create a balanced summary that captures the essential meaning while remaining accessible.
        Requirements:
        - Target approximately [length] words
        - Include main arguments, key findings, or central themes
        - Maintain logical flow and coherence
        - Preserve important context and nuance
        - Use clear, professional language
        ${keywordInstruction}

        Text to summarize:
        [text]
        REMEMBER: Your summary must be in the exact same language as the input text above.
        Summary:
      `,

      medium: `
        You are an analytical summarizer tasked with creating a comprehensive yet focused summary. 
        Balance detail with clarity.
        Requirements:
        - Target approximately [length] words
        - Cover all major points with supporting context
        - Include relevant examples, data, or evidence when mentioned
        - Organize information logically (chronologically, by importance, or by topic)
        - Maintain the original tone and intent
        ${keywordInstruction}

        Text to summarize:
        [text]
        REMEMBER: Your summary must be in the exact same language as the input text above.
        Summary:
      `,

      long: `
        You are a thorough content analyst. 
        Create a detailed summary that serves as a comprehensive reference while remaining well-organized and readable.
        Requirements:
        - Target approximately [length] words
        - Include all significant points, arguments, and supporting details
        - Preserve important quotes, statistics, or examples
        - Explain cause-and-effect relationships and implications
        - Maintain academic or professional rigor
        ${keywordInstruction}

        Text to summarize:
        [text]
        REMEMBER: Your summary must be in the exact same language as the input text above.
        Summary:
      `,
    };

    const textWordLength = text?.split(" ")?.length || 0;

    const shortLength = Math.floor((1 / 2) * textWordLength) || 0;
    const longLength = Math.floor((5 / 6) * textWordLength) || 0;
    const distance = longLength - shortLength;
    const regularLength = Math.floor(shortLength + (distance / 4) * 1) || 0;
    const mediumLength = Math.floor(shortLength + (distance / 4) * 3) || 0;

    const lengthMap = {
      short: shortLength.toString(),
      regular: regularLength.toString(),
      medium: mediumLength.toString(),
      long: longLength.toString(),
    };

    const promptTemplate = PROMPT_MODES?.[length];

    if (!promptTemplate) {
      throw { error: "INVALID_MODE", message: `Unsupported mode: ${mode}` };
    }

    const prompt = promptTemplate
      .replace("[text]", text)
      .replace("[length]", lengthMap[length])
      .replace(/\\n/g, "\n");

    const finalPrompt = `${prompt}. Please do not  provide any further explanations and unwanted text.`;

    const isStrem = true;
    let output = "";
    let tries = 0;

    while (tries < 3) {
      try {
        const streamingResp = await ShothikAIModel(
          finalPrompt,
          modelRroute.summarize,
          isStrem
        );

        // Stream data to the client
        for await (const chunk of streamingResp.stream) {
          const text = chunk.text();
          output += text;
          res.write(text);
        }
        break;
      } catch (error) {
        tries++;
        if (tries >= 3) {
          throw {
            error: "MODEL_ERROR",
            message: "To Many Request, Please try again later",
          };
        }
      }
    }

    const content = {
      before: text,
      after: output,
      mode,
      length,
    };

    // Save usage
    TrackUsage(req, {
      service: "summarize",
      word_count: String(text).split(" ").length,
    });

    if (req.user) {
      saveUsagesLogs(req.id, data, content, content, "summarize");
    }

    res.end();
  } catch (error) {
    console.error(error);

    // Log error for debugging
    saveErrorLog(error.message, "high", data, "summarize", userEmail);

    // Send a user-friendly error response if the response isn't already sent
    const statusCode = error.status || 500;
    const errorName = error.error || "unknown";
    const message =
      !error.message || error.message?.includes("VertexAI")
        ? "The server is currently unable to handle your request. Please try again later."
        : error.message;

    res.status(statusCode).json({
      error: errorName,
      message,
    });
  }
};

module.exports = {
  summarizerKeywordsController,
  summarizerController,
};
