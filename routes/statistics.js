const router = require("express").Router();

const CategoryModel = require("../models/Category");
const BrandModel = require("../models/Brand");
const ProductModel = require("../models/Item");
const UserModel = require("../models/User");
const OrderModel = require("../models/Order");
const AbundantOrderModel = require("../models/AbandonedOrder");

router.get("/documentCount", async (req, res) => {
    try {
        const categoryCount = await CategoryModel.countDocuments();
        const brandCount = await BrandModel.countDocuments();
        const productCount = await ProductModel.countDocuments();
        const orderCount = await OrderModel.countDocuments();
        const userCount = await UserModel.countDocuments();
        const abundantCount = await AbundantOrderModel.countDocuments();


        const data = [{
            name: "Categories",
            count: categoryCount,
            route: "/view-category"
        }, {
            name: "Brands",
            count: brandCount,
            route: "/view-brand"
        }, {
            name: "Users",
            count: userCount,
            route: "/view-user"
        }, {
            name: "Products",
            count: productCount,
            route: "/view-product"
        }, {
            name: "Orders",
            count: orderCount,
            route: "/view-order"
        }, {
            name: "Abandoned Orders",
            count: abundantCount,
            route: "/view-abandoned-orders"
        }]
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

module.exports = router;