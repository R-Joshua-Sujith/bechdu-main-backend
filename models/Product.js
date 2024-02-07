const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    optionHeading: String,
    optionValue: String,
    // You can adjust the data type of optionValue based on your specific needs
});
const ProductSchema = new mongoose.Schema({
    productImage: { type: String },
    basePrice: { type: Number },
    estimatedPrice: { type: Number },
    variant: { type: String },
    model: { type: String },
    brandName: { type: String },
    seriesName: { type: String },
    categoryType: { type: String },
    bestSelling: { type: String },
    dynamicFields: [optionSchema]// Dynamic fields based on the category
});

const ProductModel = mongoose.model('Product', ProductSchema);

module.exports = ProductModel;
