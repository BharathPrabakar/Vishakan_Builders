import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Load environment variables
dotenv.config();

console.log("Mongo URI:", process.env.MONGO_URL);  // Should show the Mongo URI
console.log("JWT Secret:", process.env.JWT_SECRET);  // Should show the JWT secret
console.log("Port:", process.env.PORT);  // Should show the Port number


// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send an email when a new application is submitted
async function sendNewApplicationEmail(application) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: "hr@company.com", // Replace with HR email
    subject: "New Career Application",
    text: `A new application has been submitted by ${application.name}. Check the details below:\n\nName: ${application.name}\nEmail: ${application.email}\nPhone: ${application.phone}\nResume: ${application.resumeLink}\nStatus: ${application.status}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ New application email sent to HR.");
  } catch (error) {
    console.error("❌ Error sending new application email:", error);
  }
}

// Function to send an email when the application status is updated
async function sendStatusUpdateEmail(application) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: application.email, // Applicant's email
    subject: "Application Status Update",
    text: `Dear ${application.name},\n\nYour application has been updated to: ${application.status}.\n\nThank you for applying to our company.\n\nBest regards,\nKinetic Engineering Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Status update email sent to applicant.");
  } catch (error) {
    console.error("❌ Error sending status update email:", error);
  }
}

// Career Application Schema (updated)
const careerApplicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  gender: { type: String, required: true },
  graduationYear: { type: Number, required: true },
  experience: { type: Number, required: true },
  resumeLink: { type: String, required: true },
  coverLetter: { type: String },
  status: { type: String, default: "Pending" }, // Pending/Reviewed/Rejected/Hired
  appliedDate: { type: Date, default: Date.now }
});

const CareerApplication = mongoose.model("CareerApplication", careerApplicationSchema);

// Routes
app.post("/api/career", async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'gender', 'graduationYear', 'experience', 'resumeLink'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate Google Drive link format
    if (!isValidDriveLink(req.body.resumeLink)) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide a valid Google Drive link"
      });
    }

    // Create new application
    const newApplication = new CareerApplication({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      gender: req.body.gender,
      graduationYear: req.body.graduationYear,
      experience: req.body.experience,
      resumeLink: req.body.resumeLink,
      coverLetter: req.body.coverLetter || ""
    });

    // Save to database
    await newApplication.save();

    // Send email notification to HR
    await sendNewApplicationEmail(newApplication);

    res.status(201).json({ 
      success: true,
      message: "Application submitted successfully!",
      applicationId: newApplication._id
    });

  } catch (error) {
    console.error("Error submitting application:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get all applications (for admin dashboard)
app.get("/api/career", async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = status ? { status } : {};
    
    const applications = await CareerApplication.find(filter)
      .sort({ appliedDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await CareerApplication.countDocuments(filter);
    
    res.json({
      success: true,
      applications,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });

  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch applications",
      error: error.message
    });
  }
});

// Update application status (for admin dashboard)
app.put("/api/career/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["Pending", "Reviewed", "Rejected", "Hired"].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid status value"
      });
    }

    const updatedApplication = await CareerApplication.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedApplication) {
      return res.status(404).json({ 
        success: false,
        message: "Application not found"
      });
    }

    // Send status update email to applicant
    await sendStatusUpdateEmail(updatedApplication);

    res.json({
      success: true,
      message: "Application status updated",
      application: updatedApplication
    });

  } catch (error) {
    console.error("Error updating application status:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update application status",
      error: error.message
    });
  }
});

// Helper function to validate Google Drive links
function isValidDriveLink(url) {
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([^\/]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?id=([^&]+)/
  ];
  return drivePatterns.some(pattern => pattern.test(url));
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
