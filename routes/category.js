const express = require('express');
const router = express.Router();
const Category = require('../models/category'); // Import your Mongoose model

// Handle POST request to create a new category
router.post('/create', async (req, res) => {
  try {
    // Extract data from the request body
    let { name, sections, slug } = req.body;

    // Convert the name and slug to lowercase for case-insensitive comparison
    name = name.toLowerCase();

    // Check if a category with the same name already exists
    const existingNameCategory = await Category.findOne({ name });
    if (existingNameCategory) {
      return res.status(400).json({ error: 'Category with the same name already exists' });
    }

    // Create a new Category document
    const newCategory = new Category({
      name,
      slug,
      sections,
    });

    // Save the document to the database
    await newCategory.save();

    // Respond with the saved category
    res.status(201).json({ message: 'Category created successfully' });
  } catch (error) {
    // Handle errors
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      res.status(400).json({ error: 'Category already exists' })
    } else if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      res.status(400).json({ error: "Slug should be unique for each category" })
    }
    else {
      res.status(500).json({ error: "Internal Server Error" })
    }
  }
});

// Handle PUT request to edit a category by ID
router.put('/edit-category/:categoryId', async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const { name, sections, slug } = req.body;

    // Convert the name and slug to lowercase for case-insensitive comparison
    const lowercasedName = name.toLowerCase();

    // Check if a category with the same name already exists (excluding the current category being edited)
    const existingNameCategory = await Category.findOne({ name: lowercasedName, _id: { $ne: categoryId } });
    if (existingNameCategory) {
      return res.status(400).json({ error: 'Category with the same name already exists' });
    }

    // Find the category by ID and update its fields
    const updatedCategory = await Category.findByIdAndUpdate(categoryId, {
      name: lowercasedName,
      slug,
      sections,
    }, { new: true });

    // Check if the category with the given ID exists
    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Respond with the updated category
    res.json({ message: 'Category updated successfully', category: updatedCategory });
  } catch (error) {
    console.log(error)
    // Handle errors
    if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
      res.status(400).json({ error: 'Category already exists' });
    } else if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      res.status(400).json({ error: 'Slug should be unique for each category' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});



router.get('/fetch-all-categories', async (req, res) => {
  try {
    const categories = await Category.find({}, '_id name');
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.delete('/delete/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Attempt to find and delete the category by ID
    const deletedCategory = await Category.findByIdAndDelete(categoryId);

    // Check if the category was found and deleted
    if (!deletedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/fetch-category/:categoryName', async (req, res) => {
  try {
    const categoryName = req.params.categoryName;

    // Find the category by name
    const category = await Category.findOne({ name: categoryName });

    // Check if the category with the given name exists
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Respond with the category
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
