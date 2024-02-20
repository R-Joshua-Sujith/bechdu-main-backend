const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, default: "", unique: false },
    otp: String,
    otpExpiry: Date,
    name: { type: String, default: '' },
    phone: { type: String, unique: true },
    addPhone: { type: String, default: '' },
    address: [{ type: String, default: '' }],
    pincode: { type: String, default: '' },
    city: { type: String, default: '' },
    promoStatus: { type: String, default: "false" },
    promoCodes: { type: [String], default: [] }
}, {
    timestamps: true
});

const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;
