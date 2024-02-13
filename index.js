const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors")
const dotenv = require("dotenv");

const categoryRoutes = require('./routes/category');
const adminRoutes = require("./routes/admin");
const brandRoute = require("./routes/brand");
const itemRoute = require("./routes/item");
const pincodeRoute = require("./routes/pincode");
const userRoute = require("./routes/user")

dotenv.config();
const app = express();
app.use(cors());
app.use('/uploads', express.static('uploads'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("DB Connection Successful"))
    .catch((err) => console.log(err))

// Use category routes
app.use('/api/category', categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/brand", brandRoute);
app.use("/product", itemRoute)
app.use("/pincode", pincodeRoute);
app.use("/user", userRoute);

app.listen(5000, () => {
    console.log(`Server is running`);
});
