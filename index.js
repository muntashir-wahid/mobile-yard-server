// ----------------- //
// Core dependencies
// ----------------- //
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.6ayglwi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// ----------------- //
// API endpoints
// ----------------- //

// Testing Endpoint
app.get("/", (req, res) => {
  res.send("Hello from the MobileYard server!!");
});

// All API endpoints
async function run() {
  try {
    // All Collections
    const db = client.db("mobileYard");
    const brandsCollection = db.collection("brands");

    // -------------- //
    // Create a brand
    // -------------- //
    app.post("/api/v1/brands", async (req, res) => {
      const brand = req.body;

      if (!brand.name) {
        return res.status(400).json({
          success: false,
          message: "brand name require",
        });
      }

      const result = await brandsCollection.insertOne(brand);
      brand._id = result.insertedId;

      res.status(201).json({
        success: true,
        data: {
          brand,
        },
      });
    });
  } finally {
  }
}
run().catch((err) => console.error(err));

// ----------------- //
// Start the server
// ----------------- //
app.listen(port, () => {
  console.log(`MobileYard server is running on port:${port}`);
});
