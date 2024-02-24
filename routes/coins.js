const express = require('express');
const router = express.Router();
const CoinsModel = require('../models/Coins');

// Create a new coin
router.post('/create-coins', async (req, res) => {
    try {
        const { startRange, endRange, coins } = req.body;
        const coin = new CoinsModel({ startRange, endRange, coins });
        const savedCoin = await coin.save();
        res.status(201).json(savedCoin);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get one coin by ID
router.get('/coins/:coinId', async (req, res) => {
    try {
        const coin = await CoinsModel.findById(req.params.coinId);
        if (!coin) {
            return res.status(404).json({ message: 'Coin not found' });
        }
        res.json(coin);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update one coin by ID
router.put('/coins/:coinId', async (req, res) => {
    try {
        const { startRange, endRange, coins } = req.body;
        const updatedCoin = await CoinsModel.findByIdAndUpdate(req.params.coinId, { startRange, endRange, coins }, { new: true });
        if (!updatedCoin) {
            return res.status(404).json({ message: 'Coin not found' });
        }
        res.json(updatedCoin);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete one coin by ID
router.delete('/coins/:coinId', async (req, res) => {
    try {
        const deletedCoin = await CoinsModel.findByIdAndDelete(req.params.coinId);
        if (!deletedCoin) {
            return res.status(404).json({ message: 'Coin not found' });
        }
        res.json({ message: 'Coin deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// router.get('/get-all-coins', async (req, res) => {
//     try {
//         const { page = 1, pageSize = 10, search = '' } = req.query;
//         const skip = (page - 1) * pageSize;

//         const query = {};

//         if (search) {
//             query.$or = [
//                 { startRange: { $regex: search, $options: 'i' } },
//                 { endRange: { $regex: search, $options: 'i' } },
//                 { coins: { $regex: search, $options: 'i' } }
//             ];
//         }

//         const allCoins = await CoinsModel.find(query)
//             .select('startRange endRange coins')
//             .skip(skip)
//             .limit(parseInt(pageSize));

//         const totalCoins = await CoinsModel.countDocuments(query);

//         res.send({
//             totalRows: totalCoins,
//             data: allCoins,
//         });
//     } catch (error) {
//         console.log(error)
//         res.status(500).json({ error: error.message });
//     }
// });

router.get('/get-all-coins', async (req, res) => {
    try {
        const { page = 1, pageSize = 10, search = '' } = req.query;
        const skip = (page - 1) * pageSize;

        const query = {};

        if (search) {
            const numericSearch = parseFloat(search);
            if (!isNaN(numericSearch)) {
                // If the search query can be converted to a number, perform exact match for numeric values
                query.$or = [
                    { startRange: numericSearch },
                    { endRange: numericSearch },
                    { coins: numericSearch }
                ];
            } else {
                // If the search query cannot be converted to a number, perform regex search for string values
                query.$or = [
                    { startRange: { $regex: search, $options: 'i' } },
                    { endRange: { $regex: search, $options: 'i' } },
                    { coins: { $regex: search, $options: 'i' } }
                ];
            }
        }

        const allCoins = await CoinsModel.find(query)
            .select('startRange endRange coins')
            .skip(skip)
            .limit(parseInt(pageSize));

        const totalCoins = await CoinsModel.countDocuments(query);

        res.send({
            totalRows: totalCoins,
            data: allCoins,
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
