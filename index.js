const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
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
    // get all user data from mongodb
    // Express API: /alluser
    app.get('/alluser', async (req, res) => {
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

      const skip = (page - 1) * limit;
      const users = await User.find(query).skip(skip).limit(parseInt(limit));
      const totalUsers = await User.countDocuments(query);

      res.json({ users, totalUsers });
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
      let sort = { _id: -1 }; // show by default descending order

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

    // order reated api

    //  create order api
    app.post("/user-order", async (req, res) => {
      const order = req.body;
      try {
        const result = await ordersCollection.insertOne(order);
        res.send(result);
      } catch (error) {
        console.error("Error inserting order:", error);
        res.status(500).send({ message: "Failed to insert order", error });
      }
    });

    // get mycart data
    app.get("/my-orders", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email Query is requireed" });
        }

        const query = { "user.email": email };

        const myOrder = await ordersCollection.find(query).toArray();
        res.send(myOrder);
      } catch (error) {
        console.log("Failed to get my order", error);
        res.status(500).send({ message: "Failed to data fetch", error });
      }
    });

    // delete mycart data
    app.delete("/my-orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await ordersCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({ success: true, message: "Order deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Order not found" });
        }
      } catch (error) {
        console.error("Failed to delete order", error);
        res
          .status(500)
          .send({ success: false, message: "Delete Failed", error });
      }
    });

    // Dashboard related api

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
