function formatStringArray(input) {
    // Remove the leading and trailing backticks if present
    input = input.replace(/^`|`$/g, '');

    // Parse the input string into an array of strings
    let arr;
    try {
        arr = JSON.parse(input);
    } catch (error) {
        // If parsing fails, attempt to clean the string
        const cleanedString = input.replace(/\\\"/g, '"').replace(/"undefined/g, ''); // Remove escaped quotes
        const fixedString = cleanedString.replace(/\"\s*\"/g, '","'); // Fix missing commas between strings
        arr = fixedString.split('","'); // Split the string into an array
    }

    // Remove "/" characters and format each string
    const formattedArray = arr.map(str => str.replace(/\//g, ''));

    return formattedArray;
}

function removeUndefined(paragraphs) {

    const cleanedParagraphs = paragraphs.map(paragraph => paragraph.replace(/undefined/g, ''));

    return cleanedParagraphs;
}

module.exports = {
    formatStringArray,
    removeUndefined,
};
