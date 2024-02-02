const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors")
const dotenv = require("dotenv");
const bodyParser = require('body-parser');


const categoryRoutes = require('./routes/category');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());



app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("DB Connection Successful"))
    .catch((err) => console.log(err))

// Use category routes
app.use('/api/category', categoryRoutes);

app.listen(5000, () => {
    console.log(`Server is running`);
});
