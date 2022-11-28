// ----------------- //
// Core dependencies
// ----------------- //
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const morgan = require("morgan");
const { decode } = require("punycode");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SK);

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

    // Check a sellers verified status

    const checkSellerVerifedStatus = async (req, res, next) => {
      const query = req.query;
      if (query?.email && query?.checkFor) {
        const filter = {
          email: query?.email,
          accountType: "seller",
          isVerified: true,
        };

        const verifiedSeller = await usersCollection.findOne(filter);

        if (verifiedSeller) {
          return res.send({ isVerified: true });
        } else {
          return res.send({ isVerified: false });
        }
      }

      next();
    };

    // Check admin

    const checkAdmin = async (req, res, next) => {
      const { email: decodedEmail } = req.decoded;

      const isAdmin = await usersCollection.findOne({
        email: decodedEmail,
        accountType: "admin",
      });

      if (!isAdmin) {
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

    // Chack query for phones

    const checkQuerys = async (req, res, next) => {
      const query = req.query;
      if (query?.isAdvertised) {
        const filter = { isAdvertised: true, state: "available" };
        const phones = await phonesCollection.find(filter).toArray();

        return res.status(200).json({
          success: true,
          data: {
            phones,
          },
        });
      }
      next();
    };

    // Update available status to sold

    const changeAvailableState = async (req, res, next) => {
      const query = req.query;
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };

      if (query?.state) {
        const result = await phonesCollection.updateOne(filter, {
          $set: {
            state: "sold",
          },
        });

        return res.status(200).json(result);
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

    // ************************* //

    // All API endpoints

    // ************************* //

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

      const filter = { ...user };
      const alreadyExisterdUser = await usersCollection.findOne(filter);

      if (alreadyExisterdUser) {
        return res.status(200).json({
          success: true,
          data: {
            user: alreadyExisterdUser,
          },
        });
      }

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

    app.get("/api/v1/users", checkSellerVerifedStatus, async (req, res) => {
      const email = req.query.email;
      const accountType = req.query.accountType;

      // Get buyers or sellers
      if (!email && accountType) {
        const query = { accountType };

        const users = await usersCollection.find(query).toArray();

        return res.status(200).json({
          success: true,
          data: {
            users,
          },
        });
      }

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
    // Verify a seller
    // --------------- //

    app.put("/api/v1/users/:id", verifyJWT, checkAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          isVerified: true,
        },
      };
      const options = { upsert: true };

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );

      res.status(200).json({
        result,
      });
    });

    // --------------- //
    // Delete an user
    // --------------- //

    app.delete("/api/v1/users/:id", verifyJWT, checkAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };

      const result = await usersCollection.deleteOne(filter);

      res.status(200).json({
        result,
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
    // Get phones under a brand
    // ---------------------- //

    app.get("/api/v1/phones/:brandId", async (req, res) => {
      const phoneBrand = req.params.brandId;
      const query = { phoneBrand, state: "available" };

      const phones = await phonesCollection.find(query).toArray();

      res.status(200).json({
        success: true,
        data: { phones },
      });
    });

    // ----------------------- //
    // Get phones of a seller
    // ---------------------- //

    app.get(
      "/api/v1/phones",
      checkQuerys,
      verifyJWT,
      checkSeller,
      async (req, res) => {
        const sellerEmail = req.query.email;

        const query = { sellerEmail };
        const phones = await phonesCollection
          .find(query)
          .project({
            phoneName: 1,
            state: 1,
            isAdvertised: 1,
            resellingPrice: 1,
          })
          .toArray();
        res.status(200).json({
          success: true,
          data: {
            phones,
          },
        });
      }
    );

    // ------------------------- //
    // Delete a phone by seller
    // ------------------------ //

    app.delete(
      "/api/v1/phones/:id",
      verifyJWT,
      checkSeller,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };

        const result = await phonesCollection.deleteOne(filter);

        res.status(200).json(result);
      }
    );

    // --------------------------- //
    // Update some filed of phones
    // -------------------------- //

    app.patch(
      "/api/v1/phones/:id",
      changeAvailableState,
      verifyJWT,
      checkSeller,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: ObjectId(id) };
        const query = req.query;

        let result;

        if (query?.advertise) {
          result = await phonesCollection.updateOne(filter, {
            $set: {
              isAdvertised: true,
            },
          });
        }

        // if (query?.state) {
        //   result = await phonesCollection.updateOne(filter, {
        //     $set: {
        //       state: "sold",
        //     },
        //   });
        // }

        res.status(200).json(result);
      }
    );

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

    // ------------------- //
    // Get a users booking
    // ------------------ //

    app.get("/api/v1/bookings", async (req, res) => {
      const { email } = req.query;
      const filter = { bookerEmail: email };

      const orders = await bookingsCollection.find(filter).toArray();

      res.status(200).json({
        success: true,
        data: {
          orders,
        },
      });
    });

    // ------------------- //
    // Get a booking
    // ------------------ //

    app.get("/api/v1/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };

      const booking = await bookingsCollection.findOne(query);

      res.status(200).json(booking);
    });

    // ----------------------- //
    // Update booking as paid
    // --------------------- //

    app.put("/api/v1/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const paymentInfo = req.body;
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          payment: { ...paymentInfo },
        },
      };

      const result = await bookingsCollection.updateOne(
        filter,
        updatedDoc,
        option
      );

      res.status(200).json(result);
    });

    // ---------------------- //
    // Stripe payment intent
    // -------------------- //

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = price * 100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
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
