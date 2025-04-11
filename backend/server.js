import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

app.post("/submit-form", (req, res) => {
  console.log("Received data from frontend:", req.body);
  res.status(200).json({ message: "Form submitted successfully!" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
