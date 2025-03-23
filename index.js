const express = require("express");
require("dotenv").config();
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');


//middleware
app.use(cors())
app.use(express.json());

//dbase configurations
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const cameraCollection = client.db("grentify").collection("camera");

        app.get("/camera", async (req, res) => {
            try {

              const cameras = await cameraCollection.find().toArray();
              res.json(cameras);
            } catch (error) {
              res.status(500).json({ error: "Failed to fetch data" });
            } finally {
              await client.close();
            }
          });






        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// APIs
app.get("/", (req, res) => {
    res.send("CORS is enabled!");
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));