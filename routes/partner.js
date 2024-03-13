const router = require("express").Router();
const mongoose = require("mongoose");
const PartnerModel = require("../models/Partner");
const OrderModel = require("../models/Order")
const dotenv = require("dotenv");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const DynamicModel = require('../models/Dynamic')
const createPaymentInvoice = require("./createPaymentInvoice")
const RefundModel = require("../models/Refund")

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

router.post("/create-partner", async (req, res) => {
    try {
        const {
            phone,
            name,
            email,
            address,
            pinCodes,
            state
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
            state,
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
                { state: { $regex: search, $options: 'i' } }
            ];
        }

        const allPartners = await PartnerModel.find(query)
            .select('phone name email address pinCodes coins state')
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
            state
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
        partner.state = state || partner.state;

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

// router.post('/add-pickup-person/:partnerId', async (req, res) => {
//     const partnerId = req.params.partnerId;
//     const { phone, name } = req.body;
//     const role = "pickUp";

//     try {
//         // Find the partner by ID
//         const partner = await PartnerModel.findById(partnerId);
//         if (!partner) {
//             return res.status(404).json({ error: "Partner not found" });
//         }

//         // Check if the phone number already exists in either PartnerModel or pickUpPersons
//         const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
//         if (phoneExists) {
//             return res.status(400).json({ error: "Phone number already exists" });
//         }

//         // Add the pick-up person to the partner's pickUpPersons array
//         partner.pickUpPersons.push({ phone, name, role });

//         // Save the updated partner document
//         await partner.save();

//         res.status(200).json({ message: "Pick-up person added successfully", partner });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });



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

        // const existingOrder = await OrderModel.findOne({ orderId });
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        // if (existingOrder.partner.partnerName !== '' || existingOrder.partner.partnerPhone !== '') {
        //     return res.status(400).json({ error: 'Partner already assigned for this order' });
        // }
        const order = await OrderModel.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.partner.partnerName !== '' && order.partner.partnerPhone !== '') {
            return res.status(400).json({ error: 'Order already accepted by a partner' });
        }

        const coinsToDeduct = parseInt(order.coins);
        const partnerCoins = parseInt(partner.coins);
        if (partnerCoins < coinsToDeduct) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        order.partner.partnerName = partner.name
        order.partner.partnerPhone = partnerPhone;
        order.status = "processing";


        order.logs.unshift({
            message: `Order assigned to partner ${partnerName} (${partnerPhone}) from Admin ,Coins deducted ${coinsToDeduct}`,
        });
        partner.coins = (partnerCoins - coinsToDeduct).toString();
        partner.transaction.unshift({
            type: "debited",
            coins: coinsToDeduct,
            orderID: `${order.orderId}`,
            message: `Debited for order ${order.orderId}`,
            image: `${order.productDetails.image}`
        })
        await order.save();
        await partner.save();
        res.status(200).json({ message: "order assigned successfully" });

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
            {
                $set: {
                    'partner.partnerName': "",
                    'partner.partnerPhone': "",
                    'partner.pickUpPersonName': "",
                    'partner.pickUpPersonPhone': "",
                    status: "new"
                }
            },
            { new: true }
        );

        if (updatedOrder) {
            updatedOrder.logs.unshift({ message: `Order deassigned from partner ${existingOrder.partner.partnerName} (${existingOrder.partner.partnerPhone}) from admin`, });
            await updatedOrder.save();
        } else {
            return res.status(404).json({ error: 'Order not found' });
        }

        const newRefund = new RefundModel({
            orderID: existingOrder.orderId,
            cancellationReason: "Order Deassigned from admin",
            partnerPhone: existingOrder.partner.partnerPhone,
            partnerName: existingOrder.partner.partnerName,
            coins: existingOrder.coins // Assuming you have a function to calculate the refund coins
        });
        await newRefund.save();

        res.status(200).json("Deassigned Successfully");
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
            "authkey": authkey
        }
        const response = await axios.post(apiUrl,
            {
                "template_id": sendOTP_Template_id,
                "short_url": "0",
                "recipients": [
                    {
                        "mobiles": mobileNumber,
                        "otp": otp
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
        const partner = await PartnerModel.findOne({ phone: mobileNumber });

        if (!partner) {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': mobileNumber });
            if (!user) {
                return res.status(404).json({ message: "User not found" })
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === mobileNumber);
            const result = await sendSMS(formattedMobileNumber);
            if (result && result.otp && result.otpExpiry) {
                const { otp, otpExpiry } = result;
                pickUpPerson.otp = otp;
                pickUpPerson.otpExpiry = otpExpiry
                await user.save();
                res.json({ message: "OTP Sent Successfully" });
            } else {
                res.status(500).json({ error: 'Failed to send OTP' });
            }
        } else {
            const result = await sendSMS(formattedMobileNumber);
            if (result && result.otp && result.otpExpiry) {
                const { otp, otpExpiry } = result;
                partner.otp = otp;
                partner.otpExpiry = otpExpiry;
                await partner.save();
                res.json({ message: "OTP Sent Successfully" });
            } else {
                res.status(500).json({ error: 'Failed to send OTP' });
            }
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
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "Invalid OTP" })
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!user || !pickUpPerson || pickUpPerson.otp !== otp || pickUpPerson.otpExpiry < Date.now()) {
                return res.status(400).json({ error: "Invalid OTP" });
            }

            pickUpPerson.otp = ""
            pickUpPerson.otpExpiry = ""
            pickUpPerson.loggedInDevice = req.headers['user-agent'];
            const payload = {
                loggedInDevice: req.headers['user-agent'],
                phone: phone,
                role: pickUpPerson.role,
                id: pickUpPerson._id,
            }
            const token = jwt.sign(payload, secretKey);
            await user.save();
            res.status(200).json({
                role: pickUpPerson.role,
                phone: phone,
                token: token,
                message: "Login successful"
            });
        } else {
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
        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Server Error" })
    }
})


router.get('/get-partner-orders/:partnerPhone', verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

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
                'partner.partnerPhone': '',
                status: "new"
            }).select('-deviceInfo').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize))

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
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;


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
            }).select('-deviceInfo').sort({ createdAt: -1 }).skip(skip).limit(parseInt(pageSize))

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


            const coinsToDeduct = parseInt(order.coins);
            const partnerCoins = parseInt(partner.coins);
            if (partnerCoins < coinsToDeduct) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }
            partner.transaction.unshift({
                type: "debited",
                coins: coinsToDeduct,
                orderID: `${order.orderId}`,
                message: `Debited for order ${order.orderId}`,
                image: `${order.productDetails.image}`
            })
            order.partner.partnerName = partner.name
            order.partner.partnerPhone = partnerPhone;
            order.status = "processing";
            order.logs.unshift({
                message: `Order Accepted by partner ${partner.name} (${partner.phone})`,
            });

            partner.coins = (partnerCoins - coinsToDeduct).toString();

            // order.partner.coins -= coinsToDeduct;
            await order.save();
            await partner.save();
            res.status(200).json({ message: "Order Accepted Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
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

        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            const phoneExists = await PartnerModel.exists({ $or: [{ phone }, { 'pickUpPersons.phone': phone }] });
            if (phoneExists) {
                return res.status(400).json({ error: "Phone number already exists" });
            }

            // Add the pick-up person to the partner's pickUpPersons array
            partner.pickUpPersons.push({ phone, name, role });

            // Save the updated partner document
            await partner.save();

            res.status(200).json({ message: "Pick-up person added successfully", partner });
        } else {
            res.status(403).json({ error: `No Access to perform this action` });
        }

        // Check if the phone number already exists in either PartnerModel or pickUpPersons

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get('/get-pickup-persons/:partnerPhone', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the user has access
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            // Return the pick-up persons associated with the partner
            res.status(200).json({ pickUpPersons: partner.pickUpPersons });
        } else {
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put('/block-pickup-person/:partnerPhone/:pickUpPersonId', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const pickUpPersonId = req.params.pickUpPersonId;

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the user has access
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            // Find the pick-up person by ID
            const pickUpPerson = partner.pickUpPersons.find(person => person._id.toString() === pickUpPersonId);
            if (!pickUpPerson) {
                return res.status(404).json({ error: "Pick-up person not found" });
            }

            // Update the status of the pick-up person to "blocked"
            pickUpPerson.status = "blocked";

            // Save the updated partner document
            await partner.save();

            res.status(200).json({ message: "Pick-up person blocked successfully" });
        } else {
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put('/unblock-pickup-person/:partnerPhone/:pickUpPersonId', verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const pickUpPersonId = req.params.pickUpPersonId;

    try {
        // Find the partner by phone number
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found" });
        }

        // Check if the user has access
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice) {
            // Find the pick-up person by ID
            const pickUpPerson = partner.pickUpPersons.find(person => person._id.toString() === pickUpPersonId);
            if (!pickUpPerson) {
                return res.status(404).json({ error: "Pick-up person not found" });
            }

            // Update the status of the pick-up person to "blocked"
            pickUpPerson.status = "active";

            // Save the updated partner document
            await partner.save();

            res.status(200).json({ message: "Pick-up person unblocked successfully" });
        } else {
            res.status(403).json({ error: "No access to perform this action" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post("/assign-order/:partnerPhone/:pickUpPersonId/:orderId", verify, async (req, res) => {
    try {
        const partnerPhone = req.params.partnerPhone;
        const pickUpPersonId = req.params.pickUpPersonId;

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
            if (order.partner.pickUpPersonName
                !== '' && order.partner.pickUpPersonPhone
                !== '') {
                return res.status(400).json({ error: 'Order already assigned to a pick up guy' });
            }
            const pickUpPerson = partner.pickUpPersons.find(person => person._id.toString() === pickUpPersonId);
            if (!pickUpPerson) {
                return res.status(404).json({ error: "Pick-up person not found" });
            }
            order.partner.pickUpPersonName = pickUpPerson.name;
            order.partner.pickUpPersonPhone = pickUpPerson.phone;
            order.logs.unshift({
                message: `Order Assigned to Pickup person ${pickUpPerson.name} (${pickUpPerson.phone})`,
            });
            await order.save();
            res.status(200).json({ message: "Order Assigned Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post("/deassign-order/:partnerPhone/:orderId", verify, async (req, res) => {
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
            order.logs.unshift({
                message: `Order Deassigned from Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone})`,
            });

            order.partner.pickUpPersonName = "";
            order.partner.pickUpPersonPhone = "";

            await order.save();
            res.status(200).json({ message: "Order Deassigned Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get("/partners/:phone", verify, async (req, res) => {
    const phone = req.params.phone; // Extract the phone number from the request parameters
    try {
        const partner = await PartnerModel.findOne({ phone }); // Find the partner in the database by phone number
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
            res.status(200).json(partner);
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }

        // Respond with the partner data in JSON format
    } catch (error) {
        res.status(500).json({ error: error.message }); // Handle errors
    }
});

router.put("/requote/partner/:phone/:orderId", verify, async (req, res) => {
    const orderId = req.params.orderId;
    const phone = req.params.phone;
    const { price, options } = req.body;

    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.partnerPhone != partner.phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                // Update product price and options
                order.logs.unshift({
                    message: `Order was requoted by Partner ${order.partner.partnerName} (${order.partner.partnerPhone}) from previous price ${order.productDetails.price} to current price ${price}`,
                });
                order.productDetails.price = price;
                order.productDetails.options = options;

                // Save updated order
                await order.save();

                res.status(200).json({ message: "Requote done successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was requoted by Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone}) from previous price ${order.productDetails.price} to current price ${price}`,
                });
                // Update product price and options
                order.productDetails.price = price;
                order.productDetails.options = options;

                // Save updated order
                await order.save();

                res.status(200).json({ message: "Requote done successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }


});

router.put("/update-coins-after-payment/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const { coins, price, gstPrice, paymentId, gstPercentage } = req.body;

    try {
        const CompanyData = await DynamicModel.findOne({ page: "Company Details" })
        console.log(CompanyData)
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
            let totalCoins = parseInt(partner.coins) + parseInt(coins);
            partner.coins = totalCoins.toString();
            partner.transaction.unshift({
                type: "credited",
                paymentId,
                price,
                gstPrice,
                gstPercentage,
                partnerState: partner.state,
                HomeState: CompanyData.state,
                coins: coins,
                message: "Online Payment"
            })
            await partner.save();
            res.status(200).json({ message: "Coins added successfully" });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: error.message });
    }
})

router.put("/cancel-order/:orderId/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const orderId = req.params.orderId;
    const { cancellationReason } = req.body;
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                if (order.partner.
                    partnerPhone != partner.phone
                ) {

                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                if (order.status === 'cancelled') {
                    return res.status(200).json({ message: "Order Already Cancelled" })
                }

                order.logs.unshift({
                    message: `Order was cancelled by Partner ${order.partner.partnerName} (${order.partner.partnerPhone}) Cancellation Reason : ${cancellationReason}`,
                });
                // Update the order status to 'cancel' and store the cancellation reason
                order.status = 'cancelled';
                order.cancellationReason = cancellationReason;
                const newRefund = new RefundModel({
                    orderID: order.orderId,
                    cancellationReason: cancellationReason,
                    partnerPhone: partner.phone,
                    partnerName: partner.name,
                    coins: order.coins // Assuming you have a function to calculate the refund coins
                });
                await order.save();
                await newRefund.save();
                res.status(200).json({ message: "Order cancelled successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                if (order.status === 'cancelled') {
                    return res.status(200).json({ message: "Order Already Cancelled" })
                }
                order.logs.unshift({
                    message: `Order was cancelled by Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone})
                    Cancellation Reason : ${cancellationReason} `,
                });


                order.status = 'cancelled';
                order.cancellationReason = cancellationReason;
                const newRefund = new RefundModel({
                    orderID: order.orderId,
                    cancellationReason: cancellationReason,
                    partnerPhone: partner.phone,
                    partnerName: partner.name,
                    coins: order.coins // Assuming you have a function to calculate the refund coins
                });
                await order.save();
                await newRefund.save();
                res.status(200).json({ message: "Order cancelled successfully" });

            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            console.log(error.message)
            res.status(500).json({ error: error.message });
        }
    }
})

router.put("/complete-order/:orderId/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const orderId = req.params.orderId;
    const { deviceInfo } = req.body;
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                if (order.partner.
                    partnerPhone != partner.phone
                ) {

                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was completed by Partner ${order.partner.partnerName} (${order.partner.partnerPhone})`,
                });
                // Update the order status to 'cancel' and store the cancellation reason
                order.deviceInfo = deviceInfo
                order.status = 'Completed';
                await order.save();
                res.status(200).json({ message: "Order completed successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was completed by Pickup person ${order.partner.pickUpPersonName}`,
                });
                order.deviceInfo = deviceInfo
                order.status = 'Completed';
                await order.save();
                res.status(200).json({ message: "Order completed successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

})

router.put("/reschedule-order/:orderId/:phone", verify, async (req, res) => {
    const phone = req.params.phone;
    const orderId = req.params.orderId;
    const { pickUpDetails } = req.body;
    console.log(req.body)
    if (req.user.role === "Partner") {
        try {
            const partner = await PartnerModel.findOne({ phone });
            if (!partner) {
                return res.status(404).json({ message: "Partner not found" }); // If partner not found, return 404
            }
            if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                if (order.partner.
                    partnerPhone != partner.phone
                ) {

                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was rescheduled by Partner ${order.partner.partnerName} (${order.partner.partnerPhone}) from ${order.pickUpDetails.date} ${pickUpDetails.time} to ${pickUpDetails.date} ${pickUpDetails.time} Reschedule reason : ${pickUpDetails.reason}`,
                });

                // Update the order status to 'cancel' and store the cancellation reason
                order.pickUpDetails = pickUpDetails;
                order.status = 'rescheduled';
                await order.save();
                res.status(200).json({ message: "Order rescheduled  successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: error.message });
        }
    } else if (req.user.role === "pickUp") {
        try {
            const user = await PartnerModel.findOne({ 'pickUpPersons.phone': phone });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const pickUpPerson = user.pickUpPersons.find(person => person.phone === phone);
            if (!pickUpPerson) {
                return res.status(400).json({ error: "User not found" });
            }
            if (req.user.phone === phone && req.user.loggedInDevice === pickUpPerson.loggedInDevice) {
                const order = await OrderModel.findById(orderId);

                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                if (order.partner.pickUpPersonPhone != phone) {
                    return res.status(200).json({ message: "No Access to perform this action" })
                }
                order.logs.unshift({
                    message: `Order was rescheduled by Pickup person ${order.partner.pickUpPersonName} (${order.partner.pickUpPersonPhone}) from ${order.pickUpDetails.date} ${pickUpDetails.time} to ${pickUpDetails.date} ${pickUpDetails.time} Reschedule reason : ${pickUpDetails.reason}  `,
                });

                order.pickUpDetails = pickUpDetails;
                order.status = 'rescheduled';
                await order.save();
                res.status(200).json({ message: "Order rescheduled  successfully" });
            } else {
                res.status(403).json({ error: `No Access to perform this action ` });
            }
        }
        catch (error) {
            console.log(error)
            res.status(500).json({ error: error.message });
        }
    }
})


router.get("/transaction/:partnerPhone/:transactionId", verify, async (req, res) => {
    const partnerPhone = req.params.partnerPhone;
    const transactionId = req.params.transactionId;

    try {
        const partner = await PartnerModel.findOne({ phone: partnerPhone });
        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }
        if (req.user.phone === partnerPhone && req.user.loggedInDevice === partner.loggedInDevice || req.user.role === "superadmin") {
            const transaction = partner.transaction.find(trans => trans._id.toString() === transactionId);
            if (!transaction) {
                return res.status(404).json({ message: "Transaction not found" });
            }

            const user = {
                phone: partner.phone,
                name: partner.name,
                address: partner.address,
                state: partner.state,
            };
            const invoice = {
                user,
                transaction
            }
            const pdfBuffer = await createPaymentInvoice(invoice);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
            console.log(pdfBuffer)
            res.send(pdfBuffer);

        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        console.log(error)
        console.log(error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

        // Fetch transactions only for the specified partner using their phone number
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice || req.user.role === "superadmin") {
            const transactions = partner.transaction.slice(skip, skip + parseInt(pageSize));

            res.json(transactions);
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions/credited/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

        // Fetch transactions only for the specified partner using their phone number
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
            const creditedTransactions = partner.transaction.filter(transaction => transaction.type === 'credited');
            const transactions = creditedTransactions.slice(skip, skip + parseInt(pageSize));

            res.json({
                data: transactions
            });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions/debited/:phone', verify, async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, pageSize = 5 } = req.query;
        const skip = (page - 1) * pageSize;

        // Fetch transactions only for the specified partner using their phone number
        const partner = await PartnerModel.findOne({ phone });
        if (!partner) {
            return res.status(404).json({ message: 'Partner not found' });
        }
        if (req.user.phone === phone && req.user.loggedInDevice === partner.loggedInDevice) {
            const debitedTransactions = partner.transaction.filter(transaction => transaction.type === 'debited');
            const transactions = debitedTransactions.slice(skip, skip + parseInt(pageSize));

            res.json({
                data: transactions
            });
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }


    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//for admin
router.get('/get-partner-orders-admin/:partnerPhone', verify, async (req, res) => {
    try {
        const { partnerPhone } = req.params;
        const { page = 1, pageSize = 10 } = req.query;
        const skip = (page - 1) * pageSize;

        if (req.user.role === "superadmin") {
            const orders = await OrderModel.find({ 'partner.partnerPhone': partnerPhone })
                .select('-deviceInfo -logs') // Excluding deviceInfo and logs fields
                .skip(skip)
                .limit(parseInt(pageSize))
                .sort({ createdAt: -1 });

            res.json(orders);
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
        // Fetch orders for the specified partner using their partnerPhone

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/addCoins', verify, async (req, res) => {

    const { message, coins, phone } = req.body;
    try {
        if (req.user.role === "superadmin") {
            const partner = await PartnerModel.findOne({ phone: phone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            let totalCoins = parseInt(partner.coins) + parseInt(coins);
            partner.coins = totalCoins.toString();
            partner.transaction.unshift({
                type: "credited",
                coins: coins,
                message: message
            })
            await partner.save();
            res.status(200).json({ message: "Coins Added Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: error.message });
    }

})

router.post('/deductCoins', verify, async (req, res) => {

    const { message, coins, phone } = req.body;
    try {
        if (req.user.role === "superadmin") {
            const partner = await PartnerModel.findOne({ phone: phone });
            if (!partner) {
                return res.status(404).json({ error: 'Partner not found' });
            }
            let totalCoins = parseInt(partner.coins) - parseInt(coins);
            partner.coins = totalCoins.toString();
            partner.transaction.unshift({
                type: "debited",
                coins: coins,
                message: message
            })
            await partner.save();
            res.status(200).json({ message: "Coins Deducted Successfully" })
        } else {
            res.status(403).json({ error: `No Access to perform this action ` });
        }
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: error.message });
    }

})


module.exports = router;