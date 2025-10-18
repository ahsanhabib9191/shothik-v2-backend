const mongoose = require('mongoose');

const SynonymSchema = new mongoose.Schema({
  word: String,
  synonyms: [String]
});

const Synonym = mongoose.model('synonyms', SynonymSchema);

module.exports = {
    Synonym
};
