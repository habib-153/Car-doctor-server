const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000

// middleware
app.use(cors({
  origin:[
    //'https://car-doctor-e7450.web.app',
    'http://localhost:5173',
    //'https://car-doctor-e7450.firebaseapp.com'
],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.29d8nwh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middlewares
const logger = async(req, res, next)=>{
  console.log('called: ', req.host, req.originalUrl)
  next()
}

const verifyToken = async(req, res, next)=>{
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'not authorized'});
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
    if(error){
      return res.status(401).send({message: 'not authorized'});
    }
    console.log('value in the token', decoded)
    req.user = decoded
    next()
  })
  
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db('CarDoctor').collection('Services');
    const bookingCollection = client.db('CarDoctor').collection('bookings')
    
    //auth related api
    app.post('/jwt', logger, async(req, res)=>{
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '3h'})
      res
      .cookie('token', token,{
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
      .send({success: true})
    })
    app.post('/logout', async(req, res) =>{
      const user = req.body;
      console.log('logged out', user)
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })
    
    // service related api
    app.get('/services', logger, async(req, res) =>{
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get('/services/:id', async(req, res) =>{
        const id = req.params.id;
        const query = { _id: new ObjectId(id)}
        const options = {
            projection: {
                title:1, price:1, service_id:1, img:1
            }
        }
        const result = await serviceCollection.findOne(query, options);
        res.send(result);
    })

    app.post('/bookings', async(req, res)=>{
      const booking = req.body;
      console.log(booking)
      const result = await bookingCollection.insertOne(booking)
      res.send(result);

    })

    app.get('/bookings', logger, verifyToken, async(req, res)=>{
      console.log(req.query.email)
      console.log('token', req.cookies.token)
      console.log('user in the valid token', req.user)

      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'Forbidden'})
      }
      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.patch('/bookings/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)}
      const updatedBookings = req.body;
      const updateDoc ={
        $set:{
          status: updatedBookings.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.delete('/bookings/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('doctor is running')
})

app.listen(port, ()=>{
    console.log(`Car Doctor is listening on ${port}`)
})