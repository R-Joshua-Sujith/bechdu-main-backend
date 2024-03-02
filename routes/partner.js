const router = require("express").Router();
const mongoose = require("mongoose");
const PartnerModel = require("../models/Partner");
const OrderModel = require("../models/Order")
const dotenv = require("dotenv");
const axios = require("axios");
const jwt = require("jsonwebtoken");

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

router.post("/create-partner", async (req, res) => {
    try {
        const {
            phone,
            name,
            email,
            address,
            pinCodes
        } = req.body;

        // Check if partner with the provided phone number already exists
        const existingPartner = await PartnerModel.findOne({ phone });
        if (existingPartner) {
            return res.status(409).json({ error: "A partner with this phone number already exists" });
        }

        const newPartner = new PartnerModel({
            phone,
            name,
            email,
            address,
            pinCodes,
            pickUp: [],
            role: "Partner",
            coins: "0"
        });

        await newPartner.save();

        res.status(201).json({ message: "Partner added successfully" });
    } catch (error) {
        console.log(error)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.phone) {
            res.status(400).json({ error: "A Partner with this phone number already exists" })
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }

    }
});

router.get('/get-all-coins', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { startRange: { $regex: search, $options: 'i' } },
                { endRange: { $regex: search, $options: 'i' } },
                { value: { $regex: search, $options: 'i' } }
            ];
        }

        const allCoins = await CoinsModel.find(query)
            .select('startRange endRange value')
            .sort({ createdAt: -1 }) // Assuming you have a createdAt field in your CoinsSchema
            .skip(skip)
            .limit(parseInt(pageSize));

        const totalCoins = await CoinsModel.countDocuments(query);

        res.send({
            totalRows: totalCoins,
            data: allCoins,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/get-all-partners', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
            ];
        }

        const allPartners = await PartnerModel.find(query)
            .select('phone name email address pinCodes coins')
            .sort({ createdAt: -1 }) // Assuming you have a createdAt field in your PartnerSchema
            .skip(skip)
            .limit(parseInt(pageSize));

        const totalPartners = await PartnerModel.countDocuments(query);

        // Calculate the count of pin codes for each partner
        const partnersWithPinCodeCount = allPartners.map(partner => {
            const pinCodeCount = partner.pinCodes.length;
            return {
                ...partner.toObject(),
                pinCodeCount: pinCodeCount
            };
        });

        res.send({
            totalRows: totalPartners,
            data: partnersWithPinCodeCount,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/get-partner/:id', async (req, res) => {
    try {
        const partnerId = req.params.id;

        // Find the partner by ID
        const partner = await PartnerModel.findById(partnerId);

        // Check if partner exists
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        res.json(partner);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/update-partner/:id', async (req, res) => {
    try {
        const partnerId = req.params.id;
        const {
            email,
            address,
            pinCodes,
        } = req.body;

        // Find the partner by ID
        let partner = await PartnerModel.findById(partnerId);

        // Check if partner exists
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }
        partner.email = email || partner.email;
        partner.address = address || partner.address;
        partner.pinCodes = pinCodes || partner.pinCodes;

        // Save updated partner details
        await partner.save();

        res.json({ message: "Partner updated successfully", partner });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.phone) {
            res.status(400).json({ error: "A Partner with this phone number already exists" })
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
});

router.delete('/delete-partner/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Use Mongoose to find and delete the pin code by ID
        const deletedPartner = await PartnerModel.findByIdAndDelete(id);

        if (!deletedPartner) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        res.json({ message: 'Partner deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/add-pickup-person/:partnerId', async (req, res) => {
    const partnerId = req.params.partnerId;
    const { phone, name } = req.body;
    const role = "pickUp";

    try {
        // Find the partner by ID
        const partner = await PartnerModel.findById(partnerId);
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the phone number already exists in either PartnerModel or pickUpPersons
        const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
        if (phoneExists) {
            return res.status(400).json({ error: "Phone number already exists" });
        }

        // Add the pick-up person to the partner's pickUpPersons array
        partner.pickUpPersons.push({ phone, name, role });

        // Save the updated partner document
        await partner.save();

        res.status(200).json({ message: "Pick-up person added successfully", partner });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});



//mobile
router.post('/partner-login', async (req, res) => {
    try {
        const { phone } = req.body;

        // Check if a partner with the provided phone number exists
        const partner = await PartnerModel.findOne({ phone });

        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }

        // Invalidate any previous session if partner is already logged in
        if (partner.loggedInDevice) {
            partner.loggedInDevice = null;
            await partner.save();
        }

        const payload = {
            phone: phone,
            role: partner.role,
            id: partner._id,
        }

        // Generate JWT token
        const token = jwt.sign(payload, secretKey);

        // Store device identifier in partner document
        partner.loggedInDevice = req.headers['user-agent']; // Using user-agent as device identifier
        await partner.save();

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.post('/login/pickup', async (req, res) => {
    try {
        const { phone } = req.body;

        // Find the partner with the specified pickUpPerson phone number
        const partner = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });

        if (!partner) {
            return res.status(404).json({ message: 'Pickup person not found' });
        }

        // Find the pickUpPerson within the partner
        const pickUpPerson = partner.pickUpPersons.find(person => person.phone === phone);

        // Invalidate any previous session if pickUpPerson is already logged in
        if (pickUpPerson.loggedInDevice) {
            pickUpPerson.loggedInDevice = null;
            await partner.save();
        }

        const payload = {
            phone: phone,
            role: pickUpPerson.role,
            id: pickUpPerson._id
        }

        // Generate JWT token
        const token = jwt.sign(payload, secretKey);

        // Store device identifier in pickUpPerson document
        pickUpPerson.loggedInDevice = req.headers['user-agent']; // Using user-agent as device identifier
        await partner.save();

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});


router.get('/partners/order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Fetch order details to get the orderpincode
        const order = await OrderModel.findOne({ "orderId": orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const orderpincode = order.user.orderpincode;

        // Fetch partners whose pinCodes include the orderpincode
        const matchingPartners = await PartnerModel.find({ pinCodes: orderpincode });

        res.status(200).json({ partners: matchingPartners, order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




router.put('/order/assign/partner/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { partnerName, partnerPhone } = req.body;

        const existingOrder = await OrderModel.findOne({ orderId });

        if (existingOrder.partner.partnerName !== '' || existingOrder.partner.partnerPhone !== '') {
            return res.status(400).json({ error: 'Partner already assigned for this order' });
        }


        // Update partner details in the order
        const updatedOrder = await OrderModel.findOneAndUpdate(
            { orderId },
            { $set: { 'partner.partnerName': partnerName, 'partner.partnerPhone': partnerPhone, status: 'processing' } },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.put('/order/cancel/partner/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;


        const existingOrder = await OrderModel.findOne({ orderId });



        // Update partner details in the order
        const updatedOrder = await OrderModel.findOneAndUpdate(
            { orderId },
            { $set: { 'partner.partnerName': "", 'partner.partnerPhone': "", status: "new" } },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


const sendSMS = async (mobileNumber) => {
    try {
        const otp = Math.floor(1000 + Math.random() * 9000);
        const otpExpiry = Date.now() + 600000;
        const apiUrl = 'https://control.msg91.com/api/v5/flow/';
        const headers = {
            "authkey": "413319Apv4eIy5qvDs659e4869P1"
        }
        const response = await axios.post(apiUrl,
            {
                "template_id": "659cb356d6fc05410c2c0a62",
                "short_url": "0",
                "recipients": [
                    {
                        "mobiles": mobileNumber,
                        "var": otp
                    }
                ]
            }
            , { headers })
        console.log(response.data);
        // Check if the response indicates success
        if (response.status === 200 && response.data && response.data.type === "success") {
            return { otp, otpExpiry };
        } else {
            // Handle error or failure to send OTP
            throw new Error("Failed to send OTP");
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};

router.post('/send-sms', async (req, res) => {
    const { mobileNumber } = req.body;
    const formattedMobileNumber = `91${mobileNumber}`;
    try {
        let user = await PartnerModel.findOne({ phone: mobileNumber });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const result = await sendSMS(formattedMobileNumber);
        if (result && result.otp && result.otpExpiry) {
            const { otp, otpExpiry } = result;
            user.otp = otp;
            user.otpExpiry = otpExpiry;
            await user.save();
            res.json({ message: "OTP Sent Successfully" });
        } else {
            res.status(500).json({ error: 'Failed to send OTP' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

router.post(`/sms-login`, async (req, res) => {
    try {
        const { otp, phone } = req.body;
        const partner = await PartnerModel.findOne({ phone, otp, otpExpiry: { $gt: Date.now() } });
        if (!partner) {
            return res.status(400).json({ error: "Invalid OTP" });
        }
        partner.otp = ""
        partner.otpExpiry = ""
        partner.loggedInDevice = req.headers['user-agent'];
        const payload = {
            loggedInDevice: req.headers['user-agent'],
            phone: phone,
            role: partner.role,
            id: partner._id,
        }
        const token = jwt.sign(payload, secretKey);
        await partner.save();
        res.status(200).json({
            role: partner.role,
            phone: phone,
            token: token,
            message: "Login successful"
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Server Error" })
    }
})


router.get('/get-partner-orders/:partnerPhone', verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;

        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            // Fetch orders whose pincode matches any of the partner's pinCodes
            // and partner.partnerName and partner.phone are empty strings
            const matchingOrders = await OrderModel.find({
                'user.orderpincode': { $in: partner.pinCodes },
                'partner.partnerName': '',
                'partner.partnerPhone': ''
            }).sort({ createdAt: -1 });

            res.status(200).json({ orders: matchingOrders });
        } else {
            res.status(403).json({ error: `No Access to perform this action ${req.user.loggedInDevice} ${partner.loggedInDevice}` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

});

router.get('/get-assigned-partner-orders/:partnerPhone', verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;

        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            // Fetch orders whose pincode matches any of the partner's pinCodes
            // and partner.partnerName and partner.partnerPhone are empty strings
            const matchingOrders = await OrderModel.find({
                'user.orderpincode': { $in: partner.pinCodes },
                $and: [
                    { 'partner.partnerPhone': partnerPhone }
                ]
            }).sort({ createdAt: -1 });

            res.status(200).json({ orders: matchingOrders });
        } else {
            res.status(403).json({ error: `No Access to perform this action ${req.user.loggedInDevice} ${partner.loggedInDevice}` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

});

router.post("/accept-order/:partnerPhone/:orderId", verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;

        // Fetch partner based on phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        const orderId = req.params.orderId;

        // Fetch the order by ID
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if loggedInDevice matches
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            if (order.partner.partnerName !== '' && order.partner.partnerPhone !== '') {
                return res.status(400).json({ error: 'Order already accepted by a partner' });
            }
            order.partner.partnerName = partner.name
            order.partner.partnerPhone = partnerPhone;

            const coinsToDeduct = parseInt(order.coins);
            const partnerCoins = parseInt(partner.coins);
            if (partnerCoins < coinsToDeduct) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }

            partner.coins = (partnerCoins - coinsToDeduct).toString();

            order.partner.coins -= coinsToDeduct;
            await order.save();
            await partner.save();
            res.status(200).json({ message: "Order Assigned Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ${req.user.loggedInDevice} ${partner.loggedInDevice}` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


router.post('/add-pickup-person/:partnerPhone', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const { phone, name } = req.body;
    const role = "pickUp";

    try {
        // Find the partner by ID
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the phone number already exists in either PartnerModel or pickUpPersons
        const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
        if (phoneExists) {
            return res.status(400).json({ error: "Phone number already exists" });
        }

        // Add the pick-up person to the partner's pickUpPersons array
        partner.pickUpPersons.push({ phone, name, role });

        // Save the updated partner document
        await partner.save();

        res.status(200).json({ message: "Pick-up person added successfully", partner });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


module.exports = router;