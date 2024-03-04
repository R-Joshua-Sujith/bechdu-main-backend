const router = require("express").Router();
const OrderModel = require("../models/Order");
const CounterModel = require("../models/Counter")
const UserModel = require("../models/User");
const AbundantOrderModel = require("../models/AbandonedOrder")
const multer = require('multer');
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const CoinsModel = require('../models/Coins');

dotenv.config();
const secretKey = process.env.JWT_SECRET_KEY

async function getNextSequenceValue() {
    try {
        const sequenceDocument = await CounterModel.findOneAndUpdate(
            { name: "Counter" },
            { $inc: { sequence_value: 1 } },
            { returnDocument: 'after' }
        );

        if (!sequenceDocument) {
            throw new Error("Counter document not found");
        }

        return sequenceDocument.sequence_value;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to get the next sequence value");
    }
}

// Utility function to generate custom order IDs
async function generateCustomID() {
    try {
        const sequenceValue = await getNextSequenceValue();
        console.log(sequenceValue)
        return `BECHDU${sequenceValue}`;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to generate custom ID");
    }
}

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


router.post('/create-order', verify, async (req, res) => {
    console.log(req.body)
    if (req.user.phone === req.body.user.phone) {
        try {
            const {
                user,
                payment,
                pickUpDetails,
                productDetails,
                promo
            } = req.body;
            console.log(req.body);
            const orderID = await generateCustomID();
            const existingUser = await UserModel.findOne({ phone: user.phone })
            existingUser.name = user.name;
            existingUser.addPhone = user.addPhone;
            existingUser.email = user.email;


            const useraddress = user.address;
            const pincodeRegex = /\b\d{6}\b(?=\D*$)/;
            const pincodeMatch = useraddress.match(pincodeRegex);
            const orderPincode = pincodeMatch ? pincodeMatch[0] : '';
            user.orderpincode = orderPincode;

            if (promo.code) {
                // Push the promo code into the promoCodes array in UserModel
                existingUser.promoCodes.push(promo.code);
            }
            await existingUser.save();

            let coins = 0;
            const productPrice = productDetails.price;

            // Find the appropriate document in the coinModel
            const coinModel = await CoinsModel.findOne({
                startRange: { $lte: productPrice },
                endRange: { $gte: productPrice }
            });

            if (coinModel) {
                coins = coinModel.coins;
            }

            // Create a new order instance using the OrderModel
            const newOrder = new OrderModel({
                orderId: orderID,
                user,
                payment,
                pickUpDetails,
                productDetails,
                promo,
                coins
            });

            // Save the new order to the database
            const savedOrder = await newOrder.save();
            const deletedAbundantOrder = await AbundantOrderModel.deleteMany({
                'user.phone': user.phone,
                'productDetails.slug': productDetails.slug,
            });

            res.status(201).json({ message: 'Order created successfully', order: savedOrder });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});

router.get('/get-user-orders/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const orders = await OrderModel.find({ 'user.phone': phone }).select('-deviceInfo').sort({ createdAt: -1 });
        if (!orders || orders.length === 0) {
            return res.status(404).json({ error: "No Orders Found" })
        }
        res.status(200).json({ orders })
    } catch (error) {
        res.status(500).json({ error: "Server Error" })
    }
})

router.get('/get-user-order/:phone', verify, async (req, res) => {
    if (req.user.phone === req.params.phone) {
        try {
            const { phone } = req.params;
            const orders = await OrderModel.find({ 'user.phone': phone }).select('-deviceInfo').sort({ createdAt: -1 });
            if (!orders || orders.length === 0) {
                return res.status(404).json({ error: "No Orders Found" })
            }
            res.status(200).json({ orders })
        } catch (error) {
            res.status(500).json({ error: "Server Error" })
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }
})


router.get('/get-all-orders', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        // Use a regular expression to make the search case-insensitive and partial
        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { orderId: searchRegex },
                { 'user.name': searchRegex },
                { 'user.email': searchRegex },
                { 'user.phone': searchRegex },
                { 'user.address': searchRegex },
                { 'productDetails.name': searchRegex },
            ],
        };

        const allOrders = await OrderModel.find(query)
            .select('-deviceInfo')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(pageSize));

        // Format createdAt timestamps before sending response
        const formattedOrders = allOrders.map(order => {
            return {
                ...order.toObject(),
                createdAt: order.createdAt.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Kolkata' // Indian Standard Time
                })
            };
        });

        const totalOrders = await OrderModel.countDocuments(query);

        res.json({
            totalRows: totalOrders,
            data: formattedOrders,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/get-order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find the order by orderId
        // const order = await OrderModel.findById(orderId).select('-deviceInfo');
        const order = await OrderModel.findById(orderId)

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        // Format createdAt timestamp before sending response
        const formattedOrder = {
            ...order.toObject(),
            createdAt: order.createdAt.toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Asia/Kolkata' // Indian Standard Time
            })
        };

        res.json({ data: formattedOrder });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:orderId/cancel', async (req, res) => {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;

    try {
        const order = await OrderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Update the order status to 'cancel' and store the cancellation reason
        order.status = 'cancelled';
        order.cancellationReason = cancellationReason;

        await order.save();

        return res.status(200).json({ message: 'Order canceled successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:orderId/user-cancel', verify, async (req, res) => {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;
    if (req.user.phone === req.body.phone) {
        try {
            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Update the order status to 'cancel' and store the cancellation reason
            order.status = 'cancelled';
            order.cancellationReason = cancellationReason;

            await order.save();

            return res.status(200).json({ message: 'Order canceled successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        res.status(403).json({ error: "No Access to perform this action" })
    }

});

router.put('/:orderId/complete', async (req, res) => {
    const { orderId } = req.params;
    const { deviceInfo } = req.body;
    try {
        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order Not Found' });
        }
        order.deviceInfo = deviceInfo
        order.status = 'Completed';
        await order.save();
        return res.status(200).json({ message: 'Order Completed Successfully' })
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' })
    }
})





module.exports = router;