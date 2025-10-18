function removeEnclosedText(inputText) {
  return inputText;
}

const cleanString = (data) => {
  if (!data) {
    return "";
  }

  const numberRegex = /[০-৯0-9]/g;
  const symbolRegex = /[*#.\-]/g;
  const newlineAfterColonRegex = /:(\n+)/g;
  const newlineRegex = /\n+/g;
  const noiseRegex = /<noise>/g;
  const htmlRegex = /^```html|```$/g;

  // Apply replacements sequentially
  return data
    .replace(numberRegex, "")
    .replace(symbolRegex, "")
    .replace(newlineAfterColonRegex, ":")
    .replace(newlineRegex, "")
    .replace(noiseRegex, "")
    .replace(htmlRegex, "");
};

module.exports = {
  removeEnclosedText,
  cleanString,
};
