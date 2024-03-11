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
    pinCodes: [{ type: String }],
    role: { type: String },
    pickUpPersons: [pickUpSchema],
    coins: { type: String },
    loggedInDevice: { type: String },
    otp: String,
    otpExpiry: Date,
    status: { type: String, default: "active" },
})

const PartnerModel = mongoose.model("Partner", PartnerSchema);

module.exports = PartnerModel;