const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
app.use(cors());
app.use(express.json());

//dbase configurations
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const gadgetsCollection = client.db("grentify").collection("gadgets");
    const cartCollection = client.db("grentify").collection("cart");
    const couponCollection = client.db("grentify").collection("coupons");
    const ordersCollection = client.db("grentify").collection("orders");
    const usersCollection = client.db("grentify").collection("users");

    // post single gadget data
    app.post("/gadget", async (req, res) => {
      const gadget = req.body;
      try {
        const result = await gadgetsCollection.insertOne(gadget);
        res.send(result);
      } catch (error) {
        console.log("Error inserting gadget:", error);
        res.status(500).send({ message: "Failed to intert gadget.", error });
      }
    });

    // stripe payment api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100); // Convert to cents
      console.log("Amount in cents:", amount); // Log the amount for debugging

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({ message: "Failed to create payment intent" });
      }
    })

    // get all user data from mongodb
    // Express API: /alluser
    app.get('/alluser', async (req, res) => {
      try {
        const { page = 1, limit = 12, role, status, search } = req.query;
        const query = {};

        if (role) query.role = role;
        if (status) query.status = status;
        if (search) {
          const regex = new RegExp(search, 'i');
          query.$or = [
            { name: regex },
            { email: regex },
            { phone: regex }
          ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const usersCursor = usersCollection.find(query).skip(skip).limit(parseInt(limit));
        const users = await usersCursor.toArray(); // ✅ Convert cursor to array

        const totalUsers = await usersCollection.countDocuments(query);

        res.json({ users, totalUsers }); // ✅ Now safe to send
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    //user Status api
    app.get('/user-status', async (req, res) => {
      try {
        const statusCounts = await usersCollection.aggregate([
          {
            $facet: {
              pending: [
                { $match: { status: 'pending' } },
                { $count: 'count' }
              ],
              approved: [
                { $match: { status: 'approved' } },
                { $count: 'count' }
              ],
              blocked: [
                { $match: { status: 'blocked' } },
                { $count: 'count' }
              ],
              borrower: [
                { $match: { role: 'borrower' } },
                { $count: 'count' }
              ],
              lender: [
                { $match: { role: 'lender' } },
                { $count: 'count' }
              ],
              admin: [
                { $match: { role: 'admin' } },
                { $count: 'count' }
              ]
            }
          }
        ]).toArray();

        const result = statusCounts[0]; // Access the first result from the aggregation array

        const statusData = [
          { title: 'Pending Users', number: result.pending[0]?.count || 0, bgColor: '#C435DC' },
          { title: 'Approved Users', number: result.approved[0]?.count || 0, bgColor: '#2AA75F' },
          { title: 'Blocked Users', number: result.blocked[0]?.count || 0, bgColor: '#644A07' },
          { title: 'Borrower', number: result.borrower[0]?.count || 0, bgColor: '#E32A46' },
          { title: 'Lender', number: result.lender[0]?.count || 0, bgColor: '#2C3930' },
          { title: 'Admin', number: result.admin[0]?.count || 0, bgColor: '#987070' }
        ];

        res.json(statusData);
      } catch (error) {
        console.error('Error fetching user status data:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });


    // get all gadget data from mongodb with filtering
    app.get("/gadgets", async (req, res) => {
      const search = req.query.search || "";
      const sortType = req.query.sort || "";
      const categoryParams = req.query.category || "";
      const categories = categoryParams.split(",").filter(Boolean);

      // Search Query
      const query = {
        title: { $regex: search, $options: "i" },
      };

      // Category sorting
      if (categories.length > 0) {
        query["category.value"] = { $in: categories };
      }

      // sorting logic
      let sort = { _id: -1 }; // show by default descending cart

      if (sortType === "title") {
        sort = { title: 1 };
      } else if (sortType === "price_asc") {
        sort = { price: 1 }; // low to high
      } else if (sortType === "price_desc") {
        sort = { price: -1 }; // high to low
      }

      try {
        const result = await gadgetsCollection.find(query).sort(sort).toArray();

        res.send(result);
      } catch {
        res.status(500).send({ message: "server error" });
      }
    });

    // get sidebar gadget data in mongodb for gadgets page
    app.get("/gadgets-for-sidebar", async (req, res) => {
      try {
        const result = await gadgetsCollection
          .aggregate([{ $sample: { size: 4 } }])
          .toArray();
        res.send(result);
      } catch {
        res.status(500).send({ message: "Server error" });
      }
    });

    // get limited gadget data in mongodb for home pages
    app.get("/gadgets-for-home", async (req, res) => {
      const result = await gadgetsCollection
        .find()
        .sort({ _id: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get single gadget data in mongodb
    app.get("/gadgets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await gadgetsCollection.findOne(query);
      res.send(result);
    });

    // get all orders data in mongodb
    app.get("/all-orders", async (req, res) => {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      try {
        const ordersCursor = ordersCollection.find().skip(skip).limit(parseInt(limit));
        const orders = await ordersCursor.toArray(); // ✅ Convert cursor to array

        const totalOrders = await ordersCollection.countDocuments();

        res.json({ orders, totalOrders }); // ✅ Now safe to send
      } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error' });
      }
    });

    //  create cart api
    app.post("/user-cart", async (req, res) => {
      const cart = req.body;
      try {
        const result = await cartCollection.insertOne(cart);
        res.send(result);
      } catch (error) {
        console.error("Error inserting cart:", error);
        res.status(500).send({ message: "Failed to insert cart", error });
      }
    });

    // get mycart data
    app.get("/my-cart", async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) {
          return res.status(400).send({ message: "Email Query is requireed" });
        }
        const query = { userEmail: email };
        const myCart = await cartCollection.find(query).toArray();
        res.send(myCart);
      } catch (error) {
        console.log("Failed to get my cart", error);
        res.status(500).send({ message: "Failed to data fetch", error });
      }
    });

    //save payment info to db
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      try {
        // Insert the payment into the orders collection
        const paymentResult = await ordersCollection.insertOne(payment);

        // Delete the cart item after payment
        const query = { _id: {
          $in: payment.cartItemsId.map(id => new ObjectId(id))
        }};
        const deleteResult = await cartCollection.deleteMany(query);

        res.send({paymentResult, deleteResult});

      } catch (error) {
        console.error("Error inserting payment:", error);
        res.status(500).send({ message: "Failed to insert payment", error });
      }
    });

    // GET coupon by code
    app.get("/coupon-code/:code", async (req, res) => {
      const code = req.params.code;
      console.log(code);
      try {
        const coupon = await couponCollection.findOne({ code: code });

        if (!coupon) {
          return res.status(404).send({ message: "Invalid coupon code" });
        }

        res.status(200).send({ message: "ok" });
      } catch (error) {
        res.status(500).send({ message: "Failed to check coupon code", error });
      }
    });

    // delete mycart data
    app.delete("/my-cart/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await cartCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({ success: true, message: "cart deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "cart not found" });
        }
      } catch (error) {
        console.error("Failed to delete cart", error);
        res
          .status(500)
          .send({ success: false, message: "Delete Failed", error });
      }
    });

    // Dashboard related api

    // post coupon code
    app.post("/coupon-code", async (req, res) => {
      const coupon = req.body;
      try {
        const result = await couponCollection.insertOne(coupon);
        res.send(result);
      } catch (error) {
        console.log("Error inserting gadget:", error);
        res.status(500).send({ message: "Failed to intert coupon.", error });
      }
    });

    // get all gadget data for dashboard
    app.get("/dashboard-gadgets", async (req, res) => {
      const { category, search, page, limit } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      // start with empty query for filter
      let query = {};

      // category filter by category object value
      if (category) {
        query["category.value"] = category;
      }

      // search functionality
      if (search) {
        query = {
          ...query,
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        };
      }

      try {
        // Get total count for pagination info
        const total = await gadgetsCollection.countDocuments(query);

        // Get paginated results
        const gadgets = await gadgetsCollection
          .find(query)
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limitNumber)
          .toArray();

        res.send({
          gadgets,
          total,
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
        });
      } catch (error) {
        res.status(500).send({ message: "server error" });
      }
    });

    app.get("/dashboard-mygadgets", async (req, res) => {
      const { category, search, page, limit, email } = req.query;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
    
      // Build filter query
      let query = {};
    
      // Filter by category
      if (category) {
        query["category.value"] = category;
      }
    
      // Filter by user email
      if (email) {
        query["lender.itemAddedEmail"] = email;
      }
    
      // Search by title or description
      if (search) {
        query = {
          ...query,
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        };
      }
    
      try {
        // Total count for pagination
        const total = await gadgetsCollection.countDocuments(query);
    
        // Fetch only selected fields
        const gadgets = await gadgetsCollection
          .find(query)
          .project({
            title: 1,
            price: 1,
            category: 1,
            date: 1,
            "lender.itemAddedEmail": 1,
          })
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limitNumber)
          .toArray();
    
        res.send({
          gadgets,
          total,
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
        });
      } catch (error) {
        res.status(500).send({ message: "server error" });
      }
    });
    

    // delete gadgets api
    app.delete("/dashboard-gadgets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await gadgetsCollection.deleteOne(query);
        res.send(result);
      } catch {
        console.log("Delete faield");
      }
    });

    // location data fetch
    app.get("/api/location", async (req, res) => {
      const GeoAPi = process.env.IP_GEO_LOACATION_API_KEY;
      const url = `https://api.ipgeolocation.io/ipgeo?apiKey=${GeoAPi}&fields=geo`;

      try {
        const response = await axios.get(url);
        res.json(response.data);
      } catch (error) {
        console.error("Error fetching location:", error.message);
        res.status(500).json({ error: "Failed to fetch location" });
      }
    });

    // server root api
    app.get("/", (req, res) => {
      res.send("grentify Server is running!");
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// APIs

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
