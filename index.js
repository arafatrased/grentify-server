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

    // create or post single gadget data
    app.post("/gadget", async (req, res) => {
      const gadget = req.body;
      const result = await gadgetsCollection.insertOne(gadget);
      res.send(result);
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

    // get limited gadget data in mongodb for home page 
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
