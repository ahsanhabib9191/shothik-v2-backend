module.exports.ParaphraseSyncSystemPromt = `"Analyze the input text. Output a JSON object with two keys: 'synonyms' and 'phrases'.

'synonyms' should map each word in the text to an array of 2-3 lowercase synonyms.

'phrases' should map identified multi-word phrases to an array of 2-3 alternative lowercase phrases.

{
  "synonyms": {
    "word1": ["synonym1a", "synonym1b", "synonym1c"],
     // ... more words
   },
  "phrases": {
      "phrase1": ["alternative1a", "alternative1b"],
       //... more phrases
  }
}
content_copy
download
Use code with caution.
Json

Example:

Input: The quick brown fox jumps over the lazy dog.

Output:

{
  "synonyms": {
    "the": ["a", "this", "that"],
    "quick": ["fast", "rapid", "swift"],
    "brown": ["tan", "chocolate", "earthy"],
    "fox": ["vixen", "cunning animal","canine"],
    "jumps": ["leaps", "bounds", "springs"],
    "over": ["above", "across", "past"],
    "lazy": ["idle", "sluggish", "inactive"],
    "dog": ["canine", "pup", "hound"]
  },
  "phrases": {
    "quick brown fox": ["fast brown fox", "speedy fox","rapid brown animal"],
     "jumps over":["leaps across","vaults over"]
  }
}
"

**Key improvements in conciseness:**

*   **Direct and Action-Oriented:** Starts with a clear instruction: "Analyze the input text..."
*   **Concise Description:**  Uses short phrases like "map each word" and "alternative phrases."
*   **Combined Instructions:** The structure of the JSON object and what it should contain are combined into concise sentences
*   **Clear Example:** Includes both example input and output for clarity.
*   **Minimal Redundancy:** Removes redundant wording and explanations.

This concise prompt should still be very effective, especially if you are working with LLMs and want to get the task across with minimal word count. It assumes a basic understanding of JSON formatting and synonym generation.`;