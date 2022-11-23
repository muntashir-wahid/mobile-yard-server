// ----------------- //
// Core dependencies
// ----------------- //

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// ----------------- //
// Used Middlewares
// ----------------- //
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ----------------- //
// Database setup
// ----------------- //

// ----------------- //
// API endpoints
// ----------------- //

// Testing Endpoint
app.get("/", (req, res) => {
  res.send("Hello from the MobileYard server!!");
});

// ----------------- //
// Start the server
// ----------------- //
app.listen(port, () => {
  console.log(`MobileYard server is running on port:${port}`);
});
