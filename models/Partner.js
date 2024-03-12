const mongoose = require("mongoose");


const pickUpSchema = new mongoose.Schema({
    phone: { type: String },
    name: { type: String },
    role: { type: String },
    loggedInDevice: { type: String },
    otp: String,
    otpExpiry: Date,
    status: { type: String, default: "active" },
})

const PartnerSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String },
    address: { type: String },
    state: { type: String },
    pinCodes: [{ type: String }],
    role: { type: String },
    pickUpPersons: [pickUpSchema],
    coins: { type: String },
    loggedInDevice: { type: String },
    otp: String,
    otpExpiry: Date,
    status: { type: String, default: "active" },
    transaction: [{
        type: { type: String },
        paymentId: { type: String },
        price: { type: Number },
        gstPrice: { type: Number },
        gstPercentage: { type: Number },
        partnerState: { type: String },
        HomeState: { type: String },
        coins: { type: Number },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
        image: { type: String },
        orderID: { type: String }
    }]
})

const PartnerModel = mongoose.model("Partner", PartnerSchema);

module.exports = PartnerModel;