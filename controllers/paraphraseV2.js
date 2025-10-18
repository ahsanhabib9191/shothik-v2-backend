const {
  modelRroute,
  paraphraseInstruction,
  paraphraseSynonyms,
  paraphraseInstructionV3,
  paraphraseInstructionV3ForBangla,
} = require("../AiModel/confiq");
const { saveErrorLog } = require("../mongo/models/ErrorLogs");
const { ShothikAIModel } = require("../AiModel/shothik/shothikai");
const { getIO } = require("../config/socket");
const { redis } = require("../lib/Redis");
const { trackUserData } = require("../lib/trackuserData");
const {
  ParaphraseModel,
  SentenceModel,
} = require("../mongo/models/sentenceModel");

const paraphraseForTaggingAndColoring = async (
  sentence,
  socketId,
  index,
  language,
  eventId
) => {
  try {
    // check if has cache;
    const cacheKey = `paraphrase-tagging:${sentence}`;
    let systemInstruction =
      language === "Bangla"
        ? paraphraseInstructionV3ForBangla
        : paraphraseInstructionV3;

    await middlewareHandler(
      sentence,
      systemInstruction,
      cacheKey,
      socketId,
      "tagging",
      index,
      "",
      "",
      "",
      "",
      eventId
    );
  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, "high", {}, "paraphrase", "unknown");
  }
};
const paraphraseForSynonyms = async (sentence, socketId, index, eventId) => {
  try {
    // check if has cache;
    const cacheKey = `paraphrase-synonyms:${sentence}`;
    let systemInstruction = paraphraseSynonyms;

    await middlewareHandler(
      sentence,
      systemInstruction,
      cacheKey,
      socketId,
      "synonyms",
      index,
      "",
      "",
      "",
      "",
      eventId
    );
  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, "high", {}, "paraphrase", "unknown");
  }
};

let endingSentenceIndex = 0;
const callLLM = async (
  text,
  systemInstruction,
  cacheKey,
  socketId,
  responseType,
  index = 0,
  language,
  synonymLevel,
  mode,
  freezeWord = "",
  eventId
) => {
  if (!text) return;
  console.log("calling LLM");
  const isStraming = true;
  let output = "";
  let sentenceIndex = 0;
  let sentences = [];
  let tries = 0;

  while (tries < 3) {
    try {
      const streamingResp = await ShothikAIModel(
        text,
        modelRroute.paraphrase,
        isStraming,
        1,
        systemInstruction,
        "gemini-2.0-flash"
      );

      for await (const chunk of streamingResp.stream) {
        let text = chunk.text();
        output += text.replaceAll(/[()```]/g, "");
        if (getIO()) {
          if (responseType === "plain") {
            output = output.replace(/{(.*?)}/g, (match, word) => {
              return freezeWord.includes(word) ? match : word;
            });
            text = text.replace(/{(.*?)}/g, (match, word) => {
              return freezeWord.includes(word) ? match : word;
            });
            getIO().to(socketId).emit(`paraphrase-${responseType}`, text);
            const saparator = language === "Bangla" ? "। " : ". ";
            const sentences = output.split(saparator);
            if (sentences.length > 1 && sentenceIndex < sentences.length - 1) {
              console.log("plain sentex index:", sentenceIndex);
              paraphraseForTaggingAndColoring(
                sentences[sentenceIndex],
                socketId,
                sentenceIndex,
                language,
                eventId
              );
              sentenceIndex++;
            }
          } else {
            if (output.includes("json")) {
              let sentence = output.split("json")[0].trim();
              output = output.replace(/json/g, "").replace(sentence, "").trim();
            }
          }
        }
      }

      break;
    } catch (error) {
      tries++;
      console.log("Error from shothik model", error, "input", text);
    }
  }

  if (responseType === "plain") {
    console.log("output", output);
    if (getIO())
      getIO().to(socketId).emit(`paraphrase-${responseType}`, ":end:");
    const separator = language === "Bangla" ? "। " : ". ";
    const outputSentences = output.split(separator);
    endingSentenceIndex = outputSentences.length - 1;
    do {
      console.log("sentex index:", sentenceIndex);
      let sentence = outputSentences[sentenceIndex];
      if (sentence) {
        sentence = sentence.replace(separator, "");
        paraphraseForTaggingAndColoring(
          sentence,
          socketId,
          sentenceIndex,
          language,
          eventId
        );
        sentenceIndex++;
      }
    } while (sentenceIndex < outputSentences.length);

    await ParaphraseModel.updateOne(
      { input: text, language, synonymLevel, mode, freezeWord }, // Condition to find the document
      { $push: { output } }, // Update operation
      { upsert: true } // Upsert option
    );

    redis.set(cacheKey, output);
  } else if (/synonyms|tagging/.test(responseType)) {
    try {
      sentences.push(output);
      getIO()
        .to(socketId)
        .emit(
          `paraphrase-${responseType}`,
          JSON.stringify({ index, eventId, data: JSON.parse(output) })
        );

      //call synonyms;
      if (responseType === "tagging") {
        paraphraseForSynonyms(output, socketId, index, eventId);
      } else {
        const analysis = JSON.parse(output);
        let sentence = "";
        let i = 0;
        for (const item of analysis) {
          if (i === 0 || i === analysis.length - 1) {
            sentence += item.word; // First and last word, no space
          } else {
            sentence += `${item.word === "," ? "" : " "}` + item.word; // Middle words with space
          }
          i++;
        }
        await SentenceModel.create({ sentence, analysis });
      }
      if (responseType === "synonyms" && endingSentenceIndex === index) {
        getIO().to(socketId).emit(`paraphrase-${responseType}`, ":end:");
      }
      redis.set(cacheKey, JSON.stringify(sentences));
    } catch (error) {
      console.log(error);
    }
  } else {
    console.log("unhandle response type");
  }
};

const middlewareHandler = async (
  input,
  systemInstruction,
  cacheKey,
  socketId,
  responseType,
  index = 0,
  language,
  synonymLevel = "basic",
  mode = "standard",
  freezeWord = "",
  eventId = ""
) => {
  try {

  

    // check if the data is already in the cache
    // if yes, return the data from the cache
    const cacheData = await redis.get(cacheKey);
    // const cacheData = null;
    if (cacheData) {
      console.log("cache data found, calling Redis");
      if (getIO()) {
        if (responseType === "plain") {
          getIO().to(socketId).emit(`paraphrase-${responseType}`, cacheData);
          getIO().to(socketId).emit(`paraphrase-${responseType}`, ":end:");
          const saparator = language === "Bangla" ? "। " : ". ";
          const sentences = cacheData.split(saparator);
          let sentenceIndex = 0;
          endingSentenceIndex = sentences.length - 1;
          for (const sentence of sentences) {
            if (sentence) {
              paraphraseForTaggingAndColoring(
                sentence,
                socketId,
                sentenceIndex,
                language,
                eventId
              );
              sentenceIndex++;
            }
          }
          return;
        } else if (/synonyms|tagging/.test(responseType)) {
          const sentences = JSON.parse(cacheData);
          for (const sentence of sentences) {
            getIO()
              .to(socketId)
              .emit(
                `paraphrase-${responseType}`,
                JSON.stringify({ index, eventId, data: JSON.parse(sentence) })
              );

            //call synonyms;
            if (responseType === "tagging") {
              paraphraseForSynonyms(sentence, socketId, index, eventId);
            }
            if (responseType === "synonyms" && endingSentenceIndex === index) {
              getIO().to(socketId).emit(`paraphrase-${responseType}`, ":end:");
            }
          }
        } else {
          console.log("unhandle response type");
        }
      }
    }
    // if not in cache, call the database;
    if (getIO()) {

      // if text is too slow like in one word then return the same response
      if (input.split(" ").length < 3) {
        getIO().to(socketId).emit(`paraphrase-plain`, input);
        getIO().to(socketId).emit(`paraphrase-plain`, ":end:");
        return;
      }

      // if text is one line and without full stop then add full stop at the end
      if (!input.endsWith(".")) {
        input += ".";
      }

      console.log("calling database. response type", responseType);
      if (responseType === "plain") {
        const hanveData = await ParaphraseModel.findOne({
          input,
          output: { $size: 3 }, // Correct way to check array length
          synonymLevel,
          mode,
          freezeWord,
          language,
        });
        if (hanveData) {
          const outputs = hanveData.output;
          //generate a random  number between 0 and 2
          const randomNumber = Math.floor(Math.random() * 3);
          const output = outputs[randomNumber];

          if (output) {
            getIO().to(socketId).emit(`paraphrase-plain`, output);
            getIO().to(socketId).emit(`paraphrase-plain`, ":end:");

            const saparator = language === "Bangla" ? "। " : ". ";
            const sentences = output.split(saparator);
            let sentenceIndex = 0;
            endingSentenceIndex = sentences.length - 1;

            for (const sentence of sentences) {
              if (sentence) {
                paraphraseForTaggingAndColoring(
                  sentence,
                  socketId,
                  sentenceIndex,
                  language,
                  eventId
                );
                sentenceIndex++;
              }
            }
            return;
          }
        }
      } else if (responseType === "tagging") {
        console.log("-------tagging-------, input is", input);
        if (input) {
          const sentence = input.replace(/[.]/g, "").trim();
          const haveData = await SentenceModel.findOne({
            sentence,
          });
          console.log({ sentence, haveData });
          if (haveData) {
            const output = haveData.analysis;
            if (output) {
              getIO()
                .to(socketId)
                .emit(
                  `paraphrase-synonyms`,
                  JSON.stringify({ index, eventId, data: output })
                );
              if (endingSentenceIndex === index) {
                getIO().to(socketId).emit(`paraphrase-synonyms`, ":end:");
              }
              return;
            }
          }
        }
      } else {
        console.log(
          "No data found in the database. Response type:",
          responseType
        );
      }
    }



    // call the llm
    await callLLM(
      input,
      systemInstruction,
      cacheKey,
      socketId,
      responseType,
      index,
      language,
      synonymLevel,
      mode,
      freezeWord,
      eventId
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const paraphrasePlainOutput = async (req, res) => {
  try {
    const data = req.body;
    const {
      text,
      mode,
      synonym = "basic",
      freeze,
      language = "English",
      socketId,
      eventId,
    } = data;
    const cacheKey = `paraphrase-plain-${text}-${mode}-${synonym}-${freeze}-${language}`;

    const options = {
      input: text,
      mode,
      synonym,
    };

    let systemInstruction = "";

    if (mode === "standard") {
      systemInstruction = paraphraseInstruction.standard(
        synonym,
        freeze,
        language
      );
    } else if (mode === "fluency") {
      systemInstruction = paraphraseInstruction.fluency(
        synonym,
        freeze,
        language
      );
    } else if (mode === "formal") {
      systemInstruction = paraphraseInstruction.formal(
        synonym,
        freeze,
        language
      );
    } else if (mode === "academic") {
      systemInstruction = paraphraseInstruction.academic(
        synonym,
        freeze,
        language
      );
    } else if (mode === "news") {
      systemInstruction = paraphraseInstruction.news(synonym, freeze, language);
    } else if (mode === "simple") {
      systemInstruction = paraphraseInstruction.simple(
        synonym,
        freeze,
        language
      );
    } else if (mode === "creative") {
      systemInstruction = paraphraseInstruction.creative(
        synonym,
        freeze,
        language
      );
    } else if (mode === "short") {
      systemInstruction = paraphraseInstruction.short(
        synonym,
        freeze,
        language
      );
    } else if (mode === "long") {
      systemInstruction = paraphraseInstruction.expand(
        synonym,
        freeze,
        language
      );
    }
    let responseType = "plain";
    await middlewareHandler(
      text,
      systemInstruction,
      cacheKey,
      socketId,
      responseType,
      0,
      language,
      mode,
      synonym,
      freeze,
      eventId
    );

    options.output = "plain";
    await trackUserData(req, "paraphrase", options);

    res.json({ message: "job started for proccessing" });
  } catch (error) {
    console.log(error);
    saveErrorLog(error.message, "high", {}, "paraphrase", req.email);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      error: error.error,
      message: "Please Try again",
    });
  }
};

const paraphraseWithVariantV2 = async (req, res) => {
  try {
    const data = req.body;
    const {
      text,
      mode = "standard",
      synonymLevel = "basic",
      language = "English (US)",
      freezeWord,
    } = data;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!text) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }

    //redis cache;
    const cacheKey = `paraphrase:variant:${text}:${mode}:${synonymLevel}:${language}:${freezeWord}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log("cache data found, sending from cache");
      return res.write(cachedData);
    }

    const saparator = language === "Bangla" ? "। " : ". ";

    // find data in database;
    const query = {
      input: text,
      mode,
      synonymLevel,
      language,
      freezeWord,
    };
    const dataInDB = await ParaphraseModel.findOne(query);
    if (dataInDB) {
      console.log("data found in database, sending from database");
      for (const output of dataInDB.output) {
        res.write(`${output}${saparator}`);
      }
      return;
    }

    // if data not found in database, then call llm
    console.log("data not found in database, calling llm");

    let systemInstruction = "";
    const variant = true;

    if (mode === "standard") {
      systemInstruction = paraphraseInstruction.standard(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "fluency") {
      systemInstruction = paraphraseInstruction.fluency(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "formal") {
      systemInstruction = paraphraseInstruction.formal(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "academic") {
      systemInstruction = paraphraseInstruction.academic(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "news") {
      systemInstruction = paraphraseInstruction.news(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "simple") {
      systemInstruction = paraphraseInstruction.simple(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "creative") {
      systemInstruction = paraphraseInstruction.creative(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "short") {
      systemInstruction = paraphraseInstruction.short(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    } else if (mode === "long") {
      systemInstruction = paraphraseInstruction.expand(
        synonymLevel,
        freezeWord,
        language,
        variant
      );
    }

    // shothik ai model
    const streamingResp = await ShothikAIModel(
      text,
      modelRroute.paraphrase,
      true,
      null,
      systemInstruction
    );

    let output = "";
    for await (const chunk of streamingResp.stream) {
      let text = chunk.text();
      output += text;
      res.write(text);
    }

    // save to database;
    output = output.replaceAll("\n", " ");
    let sentences = output.split(saparator);
    sentences = sentences.map((sentence) => sentence.trim());
    sentences = sentences.filter((sentence) => sentence.trim() !== "");
    await ParaphraseModel.create({
      input: text,
      language,
      synonymLevel,
      mode,
      freezeWord,
      output: sentences,
    });

    //cache result
    redis.set(cacheKey, output, 3600);
    res.end();
  } catch (error) {
    console.log("error", error);
    saveErrorLog(error.message, "high", {}, "paraphrase");
    res.status(500).json({ error: error.error, message: error.message });
  }
};

const taggingIndivisualSentence = async (req, res) => {
  try {
    const { sentence, socketId, index, language, eventId } = req.body;
    if (!sentence || !socketId || index === undefined || !language) {
      throw {
        error: "invalid-argument",
        message: "Required fields not present",
      };
    }
    endingSentenceIndex = index;
    paraphraseForTaggingAndColoring(
      sentence,
      socketId,
      index,
      language,
      eventId
    );

    res.json({ message: "job started for proccessing" });
  } catch (error) {
    console.log("error", error);
    saveErrorLog(error.message, "high", {}, "paraphrase", req.email);
    res.status(500).json({ error: error.error, message: error.message });
  }
};

module.exports = {
  paraphrasePlainOutput,
  paraphraseWithVariantV2,
  taggingIndivisualSentence,
};
