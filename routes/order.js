const router = require("express").Router();
const OrderModel = require("../models/Order");
const CounterModel = require("../models/Counter")
const UserModel = require("../models/User")
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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


router.post('/create-order', async (req, res) => {
    try {
        const {
            user,
            payment,
            pickUpDetails,
            productDetails,
            promo
        } = req.body;

        const orderID = await generateCustomID();
        const existingUser = await UserModel.findOne({ phone: user.phone })
        existingUser.name = user.name;
        existingUser.addPhone = user.addPhone;
        existingUser.email = user.email;
        existingUser.city = user.city;
        existingUser.pincode = user.pincode;
        await existingUser.save();

        // Create a new order instance using the OrderModel
        const newOrder = new OrderModel({
            orderId: orderID,
            user,
            payment,
            pickUpDetails,
            productDetails,
            promo
        });

        // Save the new order to the database
        const savedOrder = await newOrder.save();
        // const deletedAbundantOrder = await AbundantOrderModel.deleteMany({
        //     phone,
        //     'productDetails.productName': productDetails.productName,
        // });

        res.status(201).json({ message: 'Order created successfully', order: savedOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
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