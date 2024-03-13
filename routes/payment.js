const router = require("express").Router();
const PartnerModel = require("../models/Partner");
const PaymentModel = require("../models/Payment");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const DynamicModel = require('../models/Dynamic')
dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY

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



// POST endpoint to create a new payment
router.post('/create-payments', verify, async (req, res) => {
    try {
        // Extract payment details from the request body
        const { image, partnerPhone, coins, price, gstPrice, gstPercentage } = req.body;
        const phone = partnerPhone;
        const CompanyData = await DynamicModel.findOne({ page: "Company Details" })
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
        }

        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
            // Create a new payment object
            const newPayment = new PaymentModel({
                image,
                partnerPhone,
                coins,
                price,
                gstPrice,
                gstPercentage,
                partnerState: partner.state,
                HomeState: CompanyData.state,
                message: "Bank Transfer"
            });

            // Save the payment to the database
            const savedPayment = await newPayment.save();

            // Respond with the saved payment object
            res.status(201).json({ message: "Submitted Successfully" });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }

    } catch (error) {
        // Handle errors
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;


