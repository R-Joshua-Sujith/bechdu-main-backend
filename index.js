const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors")
const dotenv = require("dotenv");

const categoryRoutes = require('./routes/category');

dotenv.config();
const app = express();
app.use(cors());




app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("DB Connection Successful"))
    .catch((err) => console.log(err))

// Use category routes
app.use('/api/category', categoryRoutes);

app.listen(5000, () => {
    console.log(`Server is running`);
});
