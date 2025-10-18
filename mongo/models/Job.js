const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    running: { type: Boolean, default: false },
});


const JobModel = mongoose.model('Job', jobSchema);

module.exports = { JobModel };