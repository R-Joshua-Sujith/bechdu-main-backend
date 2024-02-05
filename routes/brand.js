const router = require("express").Router();
const BrandModel = require("../models/Brand")
const Category = require('../models/Category');

router.post("/add-brand", async (req, res) => {
    try {
        let { brandName, brandImage, series } = req.body;
        brandName = brandName.toLowerCase();
        const existingBrand = await BrandModel.findOne({ brandName });
        if (existingBrand) {
            return res.status(400).json({ error: "Brand Already exists" })
        }
        const newBrand = new BrandModel({
            brandName,
            brandImage,
            series
        })
        await newBrand.save();
        res.status(201).json({ message: "Brand Added Successfully" })
    } catch (error) {
        console.log(error)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.brandName) {
            res.status(400).json({ error: 'Brand already exists' })
        } else {
            res.status(500).json({ error: "Internal Server error" })
        }
    }
})

router.get('/brands', async (req, res) => {
    try {
        // Fetch all brands with only brandName and _id fields
        const brands = await BrandModel.find({}, 'brandName');

        // Send the response with the list of brand names and ids
        res.json(brands);
    } catch (error) {
        // Handle errors
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET all brands with optional pagination and search
router.get('/get-all-brands', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            query.$or = [
                { brandName: { $regex: search, $options: 'i' } },
            ];
        }

        const allBrands = await BrandModel.find(query)
            .select('brandName brandImage') // Include only 'brandName' and 'brandImage' fields
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(pageSize));

        const totalBrands = await BrandModel.countDocuments(query);

        res.json({
            totalRows: totalBrands,
            data: allBrands,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/brands/:id', async (req, res) => {
    try {
        const brand = await BrandModel.findById(req.params.id);
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Filter out keys with empty arrays
        const filteredSeries = Object.keys(brand.series)
            .filter((key) => brand.series[key].length > 0)
            .reduce((obj, key) => {
                obj[key] = brand.series[key];
                return obj;
            }, {});

        brand.series = filteredSeries;

        res.json(brand);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.put("/edit-brand/:id", async (req, res) => {
    try {
        const { brandName } = req.body;
        if (brandName) {
            const existingBrand = await BrandModel.findOne({ brandName: brandName.toLowerCase(), _id: { $ne: req.params.id } });
            if (existingBrand) {
                return res.status(400).json({ error: 'Brand name must be unique' });
            }
        }

        const brand = await BrandModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        res.json({ message: 'Brand edited Successfully' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server error" });
    }
});


router.delete('/delete-brand/:id', async (req, res) => {
    try {
        const brand = await BrandModel.findByIdAndDelete(req.params.id);
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }
        res.json({ message: 'Brand deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get('/brands-category/:categoryType', async (req, res) => {
    try {
        const categoryType = req.params.categoryType;

        // Find all brands that have the specified categoryType in their series object
        const brands = await BrandModel.find({ [`series.${categoryType}`]: { $exists: true, $not: { $size: 0 } } });

        if (brands.length === 0) {
            return res.status(404).json({ error: 'No brands found for the specified category type' });
        }

        // Extract only the _id and brandName fields from each brand
        const brandNames = brands.map(brand => ({
            _id: brand._id,
            brandName: brand.brandName,
            brandImage: brand.brandImage,
        }));

        res.json(brandNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



router.get('/brands-category-slug/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;

        // Find the category based on the provided slug
        const category = await Category.findOne({ slug });

        if (!category) {
            return res.status(404).json({ error: 'Category not found for the specified slug' });
        }

        const categoryType = category.category_type;

        // Find all brands that have the determined categoryType in their series object
        const brands = await BrandModel.find({ [`series.${categoryType}`]: { $exists: true, $not: { $size: 0 } } });

        if (brands.length === 0) {
            return res.status(404).json({ error: 'No brands found for the specified category type' });
        }

        // Extract only the _id, brandName, and brandImage fields from each brand
        const brandNames = brands.map(brand => ({
            _id: brand._id,
            brandName: brand.brandName,
            brandImage: brand.brandImage,
        }));

        res.json(brandNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;





router.get('/brands-category-menu/:categoryType', async (req, res) => {
    try {
        const categoryType = req.params.categoryType;

        // Find all brands that have the specified categoryType in their series object
        const brands = await BrandModel.find({ [`series.${categoryType}`]: { $exists: true, $not: { $size: 0 } } });

        if (brands.length === 0) {
            return res.status(404).json({ error: 'No brands found for the specified category type' });
        }

        // Extract only the _id and brandName fields from each brand
        // const brandNames = brands.map(brand => ({ _id: brand._id, brandName: brand.brandName, brandImage: brand.brandImage }));
        const brandNames = brands.map(brand => brand.brandName);

        res.json(brandNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



router.get('/series/:brandName/:categoryType', async (req, res) => {
    try {
        const { brandName, categoryType } = req.params;

        // Find the brand that matches the specified brandName
        const brand = await BrandModel.findOne({ brandName });

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Check if the specified categoryType exists in the brand's series object
        if (!brand.series[categoryType]) {
            return res.status(404).json({ error: 'Category type not found for this brand' });
        }

        // Fetch all seriesName values under the specified categoryType
        const seriesNames = brand.series[categoryType].map(seriesItem => seriesItem.seriesName);

        res.json(seriesNames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// API endpoint to list all models under a specific category, brand, and series
router.get('/models/:category/:brand/:series', async (req, res) => {
    try {
        const { category, brand, series } = req.params;

        // Find the brand that matches the specified brandName
        const brandData = await BrandModel.findOne({ brandName: brand });

        if (!brandData) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Check if the specified category exists in the brand's series object
        if (!brandData.series[category]) {
            return res.status(404).json({ error: 'Category not found for this brand' });
        }

        // Find the series that matches the specified seriesName
        const seriesData = brandData.series[category].find((item) => item.seriesName === series);

        if (!seriesData) {
            return res.status(404).json({ error: 'Series not found for this category' });
        }

        // Extract and return the models for the specified series
        const models = seriesData.models;
        res.json(models);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;