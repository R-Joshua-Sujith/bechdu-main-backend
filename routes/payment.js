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
                partnerName: partner.name,
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


router.get('/get-all-payments', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        // Use a regular expression to make the search case-insensitive and partial
        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { partnerPhone: searchRegex },
                { partnerState: searchRegex },
                { HomeState: searchRegex },
                // Add more fields if needed for search
            ],
        };

        const allPayments = await PaymentModel.find(query)
            .sort({ createdAt: -1 }) // Sort by createdAt in descending order
            .skip(skip)
            .limit(parseInt(pageSize))
            .select('-image'); // Excluding the image field from the response

        // Format payments before sending response
        const formattedPayments = allPayments.map(payment => {
            // Calculate totalPrice by summing price and gstPrice
            const totalPrice = payment.price + payment.gstPrice;

            return {
                ...payment.toObject(),
                createdAt: payment.createdAt.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Kolkata' // Indian Standard Time
                }),
                totalPrice: totalPrice
            };
        });

        const totalPayments = await PaymentModel.countDocuments(query);

        res.json({
            totalRows: totalPayments,
            data: formattedPayments,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;


