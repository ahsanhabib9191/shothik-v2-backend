function getPromptByMode(mode, data, language) {
  let prompt = `I want you to act as a language detector and correct only the spelling and punctuation errors in ${language}. Analyze the provided text for inaccuracies and fix them while preserving the original structure and meaning. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The text to be corrected is: \n\n${data}.`;

  let temperature = 0.3;

  switch (mode) {
    case "Fixed":
      prompt += ` Ensure all corrections adhere to ${mode} mode guidelines. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting.`;
      break;

    case "News":
      temperature = 0.2;
      prompt = `Rewrite the text in ${language} with a professional journalist's tone. Include a headline but no further explanation. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The given text is: \n\n${data}`;
      break;

    case "Simple":
      temperature = 0.2;
      prompt = `Rewrite the entire paragraph in a simple tone using ${language}, ensuring clarity and proper structure. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The text is: \n\n${data}`;
      break;

    case "Standard":
      temperature = 1.2;
      prompt = `Enhance the readability of the paragraph in ${language} while maintaining its original intent and meaning. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. Rewrite the text as follows: \n\n${data}`;
      break;

    case "Academic":
      temperature = 1.2;
      prompt = `Rewrite the paragraph in ${language} with an academic tone suitable for a professor or scholarly audience. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The given text is: \n\n${data}`;
      break;

    case "Creative":
      temperature = 1.2;
      prompt = `Rewrite the paragraph in ${language} with a creative, engaging tone. Make it compelling while preserving the original meaning. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The text is: \n\n${data}`;
      break;

    case "Technical":
      temperature = 1.2;
      prompt = `Rewrite the paragraph in ${language} with a technical and precise tone suitable for a professional or expert audience. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The given text is: \n\n${data}`;
      break;

    case "Long":
      temperature = 1.2;
      prompt = `Expand the paragraph in ${language}, adding more details and depth without introducing a headline. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The given text is: \n\n${data}`;
      break;

    case "Short":
      temperature = 1.2;
      prompt = `Condense the paragraph in ${language} into a short, concise version. Your task is to return the refined text as plain output without any explanations, headings, or additional formatting. The text is: \n\n${data}`;
      break;

    default:
      break;
  }

  return {
    prompt,
    temperature,
  };
}

module.exports = { getPromptByMode };
