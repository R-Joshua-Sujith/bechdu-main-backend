const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, default: '' },
    otp: String,
    otpExpiry: Date,
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    phone: { type: String, unique: true },
    addPhone: { type: String, default: '' },
    address: [{ type: String, default: '' }],
    pincode: { type: String, default: '' },
    city: { type: String, default: '' },
    promoStatus: { type: String, default: "false" },
    promoCodes: { type: [String], default: [] }
});

const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;
