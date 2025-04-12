const express = require('express');
const router = express.Router();
const CareerApplication = require('../models/CareerApplication');

router.post('/api/career', async (req, res) => {
    try {
        const { name, email, phone, gender, graduationYear, experience, resumeLink } = req.body;

        // Validate required fields
        if (!name || !email || !phone || !gender || !graduationYear || !experience || !resumeLink) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Create a new career application
        const application = new CareerApplication({
            name,
            email,
            phone,
            gender,
            graduationYear,
            experience,
            resumeLink,
        });

        await application.save();
        res.status(201).json({ success: true, message: 'Application submitted successfully' });
    } catch (error) {
        console.error('Error saving application:', error.message);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

module.exports = router;
