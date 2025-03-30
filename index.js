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

    // post single gadget data in mongodb
    app.post("/gadget", async (req, res) => {
      const gadget = req.body;
      const result = await gadgetsCollection.insertOne(gadget);
      res.send(result);
    });

    // get all gadget data in mongodb
    app.get("/gadgets", async (req, res) => {
      const result = await gadgetsCollection.find().toArray();
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
