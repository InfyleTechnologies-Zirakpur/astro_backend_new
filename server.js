const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

// Database
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Matchmaking API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Matchmaking API is running" });
});

// Routes
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/questionnaire", require("./routes/questionnaireRoutes"));
app.use("/api/horoscope", require("./routes/horoscopeRoutes"));
app.use("/api/matchmaking", require("./routes/matchMakingRoute"));
app.use("/api/astro-qa", require("./routes/astroQARoutes"));

app.use((error, req, res, next) => {
  if (error.name === "ValidationError") return res.status(422).json({ success: false, message: "Validation failed" });
  if (error.code === 11000) return res.status(409).json({ success: false, message: "A record with that value already exists" });
  if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid identifier" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

