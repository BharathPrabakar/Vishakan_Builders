import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
//const MONGO_URI = 'mongodb://localhost:27017/vishakanbuilders'; // Update with your database name

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1); // Exit the process if the connection fails
    });

// Handle connection errors after initial connection
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send an email to HR when a new application is submitted
async function sendNewApplicationEmail(application) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "hr@company.com", // Replace with actual HR email
    subject: "New Career Application Submitted",
    text: `
A new career application has been submitted.

Name: ${application.name}
Email: ${application.email}
Phone: ${application.phone}
Gender: ${application.gender}
Graduation Year: ${application.graduationYear}
Experience: ${application.experience} years
Resume Link: ${application.resumeLink}

View it on the dashboard.
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Application email sent to HR");
  } catch (error) {
    console.error("❌ Failed to send email to HR:", error);
  }
}

// Career Application Schema
const careerApplicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  gender: { type: String, required: true },
  graduationYear: { type: Number, required: true },
  experience: { type: String, required: true },
  resumeLink: { type: String, required: true },
  appliedDate: { type: Date, default: Date.now }
});

const CareerApplication = mongoose.model("CareerApplication", careerApplicationSchema);

// Helper: Validate Google Drive resume link
function isValidDriveLink(url) {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^\/]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?id=([^&]+)/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

// POST: Submit career application
app.post("/api/career", async (req, res) => {
  try {
    console.log("📩 Received data:", req.body);

    const requiredFields = [
      'name', 'email', 'phone', 'gender',
      'graduationYear', 'experience', 'resumeLink'
    ];

    const missing = requiredFields.filter(field => !req.body[field]);
    if (missing.length > 0) {
      console.log("❌ Missing fields:", missing);
      return res.status(400).json({
        success: false,
        message: `Missing fields: ${missing.join(', ')}`
      });
    }

    if (!isValidDriveLink(req.body.resumeLink)) {
      console.log("❌ Invalid resume link:", req.body.resumeLink);
      return res.status(400).json({
        success: false,
        message: "Invalid Google Drive resume link"
      });
    }

    const newApp = new CareerApplication({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      gender: req.body.gender,
      graduationYear: req.body.graduationYear,
      experience: req.body.experience,  // Experience is sent from the frontend as 'role'
      resumeLink: req.body.resumeLink
    });

    console.log("✅ Saving to MongoDB...");
    await newApp.save();
    console.log("✅ Saved successfully!");

    await sendNewApplicationEmail(newApp);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      applicationId: newApp._id
    });

  } catch (err) {
    console.error("🔥 Caught server error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
});

// GET: Fetch all career applications
app.get("/api/career", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const applications = await CareerApplication.find()
      .sort({ appliedDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await CareerApplication.countDocuments();

    res.json({
      success: true,
      applications,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });

  } catch (err) {
    console.error("❌ Error fetching applications:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching applications",
      error: err.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
