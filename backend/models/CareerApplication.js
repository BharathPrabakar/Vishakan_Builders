const mongoose = require('mongoose');

const careerApplicationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    gender: { type: String, required: true },
    graduationYear: { type: Number, required: true },
    experience: { type: String, required: true },
    resumeLink: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('CareerApplication', careerApplicationSchema);
