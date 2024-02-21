const router = require("express").Router();
const PromoCodeModel = require("../models/PromoCode")
const UserModel = require("../models/User")

router.post('/create/promocode', async (req, res) => {
    try {
        const promoCodeData = req.body;
        const newPromoCode = new PromoCodeModel(promoCodeData);
        const savedPromoCode = await newPromoCode.save();
        res.status(201).json(savedPromoCode);
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.code) {
            res.status(400).json({ error: "Promo Code already exists" });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.get('/get-all-promocode', async (req, res) => {
    try {
        const { page = 1, pageSize = 5, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { code: searchRegex },
            ],
        }

        const allPromoCode = await PromoCodeModel.find(query).skip(skip).limit(parseInt(pageSize));
        const totalPromoCode = await PromoCodeModel.countDocuments();

        res.json({
            totalRows: totalPromoCode,
            data: allPromoCode,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/promoCode/:id', async (req, res) => {
    try {
        const promoCode = await PromoCodeModel.findById(req.params.id);

        if (!promoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        return res.json(promoCode);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.put('/update/promocode/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discountAmount } = req.body;

        const updatedPromoCode = await PromoCodeModel.findByIdAndUpdate(
            id,
            { code, discountAmount },
            { new: true } // returns the updated document
        );

        if (!updatedPromoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        res.json(updatedPromoCode);
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.code) {
            res.status(400).json({ error: "Promo Code already exists" });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

router.delete('/delete/promocode/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const deletedPromoCode = await PromoCodeModel.findByIdAndDelete(id);

        if (!deletedPromoCode) {
            return res.status(404).json({ message: 'Promo code not found' });
        }

        res.json({ message: 'Promo code deleted successfully' });
    } catch (error) {
        console.error('Error deleting promo code:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


router.post('/check/promocode', async (req, res) => {
    try {
        const { enteredCode, phone } = req.body;

        // Find the promo code in the database
        const promoCode = await PromoCodeModel.findOne({ code: enteredCode });

        if (!promoCode) {
            return res.json({ valid: false, message: 'Invalid promo code' });
        }

        // Check if the promo code is already used by the user
        const user = await UserModel.findOne({ phone: phone, promoCodes: enteredCode });

        if (user) {
            return res.json({ valid: false, message: 'Promo code already used by this user' });
        }

        // If the promo code is valid and not used by the user, return its value
        res.json({ valid: true, value: promoCode.discountAmount, message: 'Promo Code Applied Successfully' });
    } catch (error) {
        console.error('Error checking promo code validity:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
module.exports = router;