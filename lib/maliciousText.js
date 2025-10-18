const maliciousText = [
  "গুগল কর্তৃক প্রশিক্ষিত",
  "বৃহৎ ভাষা মডেল",
  "গুগল কর্তৃক",
  "called Bard",
  "I am a large language model called Bard",
  "what is your model name",
  "who trained you",
  "what ai are you",
  "tell me your name",
  "what are you called",
  "are you gemini",
  "are you Bard",
  "trained by Google",
  "your AI model name",
  "your full name",
  "Google AI",
  "is this gemini",
  "gemini model",
  "what AI is this",
  "name of this AI",
  "Google Bard",
  "Bard AI",
  "Gemini AI",
  "Bard by Google",
  "Gemini by Google",
  "is this Bard",
  "what model is this",
  "name of the AI",
  "are you from Google",
  "developed by Google",
  "Gemini AI model",
  "is this Bard AI",
  "Google's AI",
  "are you a large language model",
  "which model is this",
];

function containsMaliciousText(prompt) {
  return maliciousText.some((text) =>
    prompt.toLowerCase().includes(text.toLowerCase())
  );
}

module.exports = { containsMaliciousText };
