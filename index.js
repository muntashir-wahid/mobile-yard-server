// ----------------- //
// Core dependencies
// ----------------- //
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const morgan = require("morgan");
const { decode } = require("punycode");
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
    const phonesCollection = db.collection("phones");
    const bookingsCollection = db.collection("bookings");

    // --------------------- //
    // Custome Middlewared
    // ---------------------- //

    // Check user
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

    // Check seller

    const checkSeller = async (req, res, next) => {
      const { email: decodedEmail } = req.decoded;

      const user = await usersCollection.findOne({ email: decodedEmail });

      if (!user || user.accountType !== "seller") {
        return res.status(403).json({
          success: false,
          message: "unauthorized access",
        });
      }

      next();
    };

    // Chacke already booking

    const checkAlreadyBooking = async (req, res, next) => {
      const body = req.body;
      const { email: decodedEmail } = req.decoded;
      const { bookerEmail } = body;

      if (bookerEmail !== decodedEmail) {
        return res.status(403).json({
          success: false,
          message: "unauthorized access",
        });
      }

      const { bookerContact, meetingLocation, ...rest } = body;

      const alreadyBooking = await bookingsCollection.findOne(rest);

      if (alreadyBooking) {
        return res.json({
          success: false,
          message: "Cant book an item twice",
        });
      }

      next();
    };

    // ----------- //
    // Verify jwt
    // ----------- //

    const verifyJWT = (req, res, next) => {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).json({
          success: false,
          message: "unauthorized access",
        });
      }

      const [_, token] = authorization.split(" ");

      jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
        if (err) {
          return res.status(403).json({
            success: false,
            message: "unauthorizes access",
          });
        }

        req.decoded = decoded;
        next();
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
    // Get all brands
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

    // --------------- //
    // Create a phone
    // --------------- //
    app.post("/api/v1/phones", verifyJWT, checkSeller, async (req, res) => {
      const phone = req.body;

      const result = await phonesCollection.insertOne(phone);
      phone._id = result.insertedId;

      res.status(201).json({
        success: true,
        data: {
          phone,
        },
      });
    });

    // ----------------------- //
    // Get phone under a brand
    // ---------------------- //

    app.get("/api/v1/phones/:brandId", async (req, res) => {
      const phoneBrand = req.params.brandId;
      const query = { phoneBrand };

      const phones = await phonesCollection.find(query).toArray();

      res.status(200).json({
        success: true,
        data: { phones },
      });
    });

    // --------------- //
    // Create a booking
    // --------------- //

    app.post(
      "/api/v1/bookings",
      verifyJWT,
      checkAlreadyBooking,
      async (req, res) => {
        const booking = req.body;

        const result = await bookingsCollection.insertOne(booking);
        booking._id = result.insertedId;

        res.status(201).json({
          success: true,
          data: {
            booking,
          },
        });
      }
    );
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
