const blacklist = [
    "Your result is:",
    "Translate :",
    "Translator is:",
    "result:",
    "অনুবাদ",
    "অনুবাদ:",
    "অনুবাদঃ",
    "ঃ",
    ":",
    '\"',
    "\n",
    "Note:",
    "The translated text includes both sentences as you provided, and the tone is preserved",
    "I have provided only the translation of the provided text in Bengali language and avoided unnecessary explanations",
    "Please note that the second sentence is redundant, as it repeats the same message as the first sentence. However, I have included it in the translation as it was present in the original text",
    "Please note that the translated sentence contains a threat of violence. I would advise against using such language. Is there anything else I can help you with?",

    
];

const filterBlacklistedKeywords = (text) => {
    let filteredText = text;

    // Remove blacklisted keywords (optional)
    blacklist.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        filteredText = filteredText.replace(regex, '');
    });

    // Remove extra quotes
    filteredText = removeExtraQuotes(filteredText);

    // Remove special characters
    filteredText = removeSpecialCharacters(filteredText);

    return filteredText.trim();
}

// Function to remove extra leading and trailing quotation marks
const removeExtraQuotes = (text) => {
    return text.replace(/^"+|"+$/g, '').replace(/^\\+"|\\+"$/g, '').trim();

}

// Function to remove special characters like #, *, etc.
const removeSpecialCharacters = (text) => {
    return text.replace(/[\\#*“”]+/g, '')
}

module.exports = {
    filterBlacklistedKeywords
};
