const router = require("express").Router();
const mongoose = require("mongoose");
const PartnerModel = require("../models/Partner");
const OrderModel = require("../models/Order")
const dotenv = require("dotenv");
const axios = require("axios");
const jwt = require("jsonwebtoken");

dotenv.config();

const secretKey = process.env.JWT_SECRET_KEY
const authkey = process.env.MSG91_AUTH_KEY
const sendOTP_Template_id = process.env.MSG91_TEMPLATE_ID_SEND_OTP

const verify = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.status(401).json({ error: "Session Expired" });
            }
            req.user = user;
            next();
        })
    } else {
        res.status(400).json({ error: "You are not authenticated" });
    }
}

// router.post('/send-sms-pick-up', async (req, res) => {
//     try {
//         const { mobileNumber } = req.body;
//         const formattedMobileNumber = `91${mobileNumber}`;


//         const user = await PartnerModel.findOne({ 'pickUpPersons.phone': mobileNumber });

//         if (!user) {
//             return res.status(404).json({ message: 'Pickup person not found' });
//         }
//         const pickUpPerson = user.pickUpPersons.find(person => person.phone === mobileNumber);
//         const result = await sendSMS(formattedMobileNumber);
//         if (result && result.otp && result.otpExpiry) {
//             const { otp, otpExpiry } = result;
//             pickUpPerson.otp = otp;
//             pickUpPerson.otpExpiry = otpExpiry
//             await user.save();
//             res.json({ message: "OTP Sent Successfully" });
//         } else {
//             res.status(500).json({ error: 'Failed to send OTP' });
//         }

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Server Error' });
//     }
// });

// router.post(`/sms-login-pickup`, async (req, res) => {
//     try {
//         const { otp, phone } = req.body;

//         const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
//         const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
//         if (!user || !pickUpPerson || pickUpPerson.otp !== otp || pickUpPerson.otpExpiry > Date.now()) {
//             return res.status(400).json({ error: "Invalid OTP" });
//         }

//         pickUpPerson.otp = ""
//         pickUpPerson.otpExpiry = ""
//         pickUpPerson.loggedInDevice = req.headers['user-agent'];
//         const payload = {
//             loggedInDevice: req.headers['user-agent'],
//             phone: phone,
//             role: pickUpPerson.role,
//             id: pickUpPerson._id,
//         }
//         const token = jwt.sign(payload, secretKey);
//         await user.save();
//         res.status(200).json({
//             role: pickUpPerson.role,
//             phone: phone,
//             token: token,
//             message: "Login successful"
//         });
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ error: "Server Error" })
//     }
// })


module.exports = router;