const permission = {
  without_login: {
    paraphrase: {
      api: 0,
      word: 180,
      total_word: 0,
      mode: ["standard", "fluency"],
    },
    bypass: {
      api: 0,
      word: 300,
      total_word: 0,
      model: "panda",
    },
    grammar: {
      api: 0,
      word: 250,
      total_word: 0,
    },
    translator: {
      api: 0,
      word: 250,
      total_word: 0,
    },
    summarize: {
      api: 0,
      word: 250,
      total_word: 0,
    },
    "ai-detector": {
      api: 0,
      word: 250,
      total_word: 0,
    },
  },
};

module.exports = {
  permission,
};
