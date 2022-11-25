// ----------------- //
// Core dependencies
// ----------------- //
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
    const usersCollection = db.collection("users");

    // --------------------- //
    // Custome Middlewared
    // ---------------------- //

    const checkUser = async (req, res, next) => {
      const { email, registered } = req.query;

      if (registered === "false") {
        return next();
      }

      const query = { email };

      const storedUser = await usersCollection.find(query).toArray();

      if (storedUser.length) {
        return next();
      }
      res.status(400).json({
        success: false,
        message: "no user found",
      });
    };

    // ----------- //
    // Issue a jwt
    // ----------- //

    app.get("/api/v1/jwt", checkUser, async (req, res) => {
      const email = req.query.email;

      jwt.sign(
        { email },
        process.env.SECRET_KEY,
        { expiresIn: "1h" },
        function (err, token) {
          if (err) {
            res.status(500).send("something broke");
          }
          res.status(200).json({
            success: true,
            token,
          });
        }
      );
    });

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

    // --------------- //
    // Read all brands
    // --------------- //

    app.get("/api/v1/brands", async (req, res) => {
      const query = {};
      const availableBrands = await brandsCollection.find(query).toArray();

      res.status(200).json({
        success: true,
        data: {
          availableBrands,
        },
      });
    });

    // --------------- //
    // Create a user
    // --------------- //
    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;

      const result = await usersCollection.insertOne(user);
      user._id = result.insertedId;

      res.status(201).json({
        success: true,
        data: {
          user,
        },
      });
    });

    // --------------- //
    // Get a user
    // --------------- //

    app.get("/api/v1/users", async (req, res) => {
      const email = req.query.email;

      const query = { email };

      const user = await usersCollection.findOne(query);

      res.status(200).json({
        success: true,
        data: {
          user,
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
