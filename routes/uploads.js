const router = require("express").Router();
const fs = require('fs');
const path = require('path');
const multer = require("multer");

router.get('/get-images', (req, res) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const folderPath = path.join(__dirname, '../uploads');
        const skip = (page - 1) * pageSize;

        // Read the contents of the folder
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                return res.status(500).send('Error reading folder');
            }

            // Filter out non-image files if needed
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif';
            });

            // Get the total count of images
            const totalImages = imageFiles.length;

            // Slice the array of image files to get the images for the requested page
            const imagesForPage = imageFiles.slice(skip, skip + pageSize);

            // Construct an array of objects containing image data for the requested page
            const imageData = imagesForPage.map(file => {
                const filePath = path.join(folderPath, file);
                const data = fs.readFileSync(filePath).toString('base64');
                return {
                    filename: file,
                    data: `data:image/${path.extname(file).slice(1)};base64,${data}`
                };
            });

            // Send the list of image data for the requested page along with total image count as JSON
            res.json({
                totalImages,
                images: imageData.slice(0, pageSize) // Apply the limit here
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

router.post("/upload-images", upload.array("images", 50), (req, res) => {
    if (req.files.length > 50) {
        return res.status(400).json({ error: "Maximum 50 images allowed" });
    }

    // File upload logic
    const uploadedFiles = req.files.map(file => {
        return {
            filename: file.originalname,
            path: file.path // Path where the file is stored
        };
    });

    // You can further process or store the uploaded files as needed

    res.status(200).json({ message: "Images uploaded successfully", files: uploadedFiles });
});
module.exports = router;