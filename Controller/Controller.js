const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

const url =
  "mongodb+srv://adilbitech1999:adilbitech1999@attendance.m0rrdop.mongodb.net/?retryWrites=true&w=majority&appName=Attendance";
const client = new MongoClient(url);
const JWT_SECRET = "your_super_secret_key";

const publicShowcaseIcons = async (req, res) => {
  try {
    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc || !iconsDoc.icons) {
      return res.status(404).json({ status: false, message: "No icons found" });
    }

    // Create a new object for non-deleted categories and their icons
    const formattedData = {};

    for (const [categoryName, category] of Object.entries(iconsDoc.icons)) {
      if (category.deleted) continue;
      formattedData[capitalize(categoryName)] = category.data || [];
    }

    return res.json({
      status: "success",
      data: formattedData, // ✅ not just "business"
    });
  } catch (err) {
    console.error("Error in public showcase endpoint:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

// Helper to capitalize first letter
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const getIconsCategories = async (req, res) => {
  try {
    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    // Get the document
    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc) {
      return res
        .status(404)
        .json({ status: false, message: "Icons document not found" });
    }

    // Transform data format — skip deleted categories
    const formattedData = {};
    for (const [categoryName, categoryData] of Object.entries(iconsDoc.icons)) {
      if (categoryData.deleted) continue; // ✅ skip deleted

      const capitalizedName =
        categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
      formattedData[capitalizedName] = categoryData.data || [];
    }

    // Send response
    res.json({
      status: true,
      data: formattedData,
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

const addIconCategory = async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "Category name is required" });
  }

  try {
    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    // Get the document (assuming only one main icons document)
    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Icons document not found" });
    }

    // Check if category already exists
    if (iconsDoc.icons.hasOwnProperty(name)) {
      return res
        .status(400)
        .json({ success: false, message: "Category already exists" });
    }

    // Add the new category with default values
    await iconsCollection.updateOne(
      { _id: iconsDoc._id },
      {
        $set: {
          [`icons.${name}`]: {
            deleted: false,
            data: [],
          },
        },
      }
    );

    res.json({
      success: true,
      message: `Category '${name}' added successfully`,
    });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const singleIconCategory = async (req, res) => {
  try {
    const categoryName = req.params.name; // e.g., 'business'

    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    // Get the document (assuming only one exists)
    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc || !iconsDoc.icons[categoryName]) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Return only the requested category object
    res.json({
      success: true,
      category: {
        [categoryName]: iconsDoc.icons[categoryName],
      },
    });
  } catch (err) {
    console.error("Error fetching category:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteIconCategory = async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ success: false, message: "Category name is required" });
  }

  try {
    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    // Get the icons document
    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Icons document not found" });
    }

    // Check if category exists
    if (!iconsDoc.icons.hasOwnProperty(name)) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Update deleted to true
    await iconsCollection.updateOne(
      { _id: iconsDoc._id },
      { $set: { [`icons.${name}.deleted`]: true } }
    );

    res.json({
      success: true,
      message: `Category '${name}' marked as deleted`,
    });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const uploadIcons = async (req, res) => {
  try {
    const categoryName = req.params.name.toLowerCase();

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    // Get the current icons document
    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc) {
      return res.status(404).json({
        success: false,
        message: "Icons document not found",
      });
    }

    // Check if category exists
    if (!iconsDoc.icons[categoryName]) {
      req.files.forEach((file) => fs.unlinkSync(file.path));
      return res.status(404).json({
        success: false,
        message: `Category '${categoryName}' not found`,
      });
    }

    // Check if category is deleted
    if (iconsDoc.icons[categoryName].deleted) {
      req.files.forEach((file) => fs.unlinkSync(file.path));
      return res.status(400).json({
        success: false,
        message: `Category '${categoryName}' is deleted and cannot accept new icons`,
      });
    }

    // Create URLs for all uploaded files
    const iconUrls = req.files.map(
      (file) => `${req.protocol}://${req.get("host")}/icons/${file.filename}`
    );

    // Push all URLs to the category's data array
    const updateResult = await iconsCollection.updateOne(
      {},
      {
        $push: {
          [`icons.${categoryName}.data`]: { $each: iconUrls },
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      req.files.forEach((file) => fs.unlinkSync(file.path));
      return res.status(500).json({
        success: false,
        message: "Failed to update database",
      });
    }

    res.status(201).json({
      success: true,
      message: `${iconUrls.length} icon(s) uploaded successfully`,
      data: {
        category: categoryName,
        iconUrls,
        files: req.files.map((file) => ({
          fileName: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
        })),
      },
    });
  } catch (err) {
    if (req.files) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
    }

    console.error("Error uploading icons:", err);

    res.status(500).json({
      success: false,
      message: "Server error during file upload",
    });
  }
};

const deleteIcon = async (req, res) => {
  const categoryName = req.params.name.toLowerCase();
  const { iconUrl } = req.body;

  if (!iconUrl) {
    return res.status(400).json({
      success: false,
      message: "Icon URL is required",
    });
  }

  try {
    await client.connect();
    const db = client.db("test");
    const iconsCollection = db.collection("icons");

    const iconsDoc = await iconsCollection.findOne({});
    if (!iconsDoc) {
      return res.status(404).json({
        success: false,
        message: "Icons document not found",
      });
    }

    // Check if category exists
    if (!iconsDoc.icons[categoryName]) {
      return res.status(404).json({
        success: false,
        message: `Category '${categoryName}' not found`,
      });
    }

    // Check if icon exists in the category
    const iconExists = iconsDoc.icons[categoryName].data.includes(iconUrl);
    if (!iconExists) {
      return res.status(404).json({
        success: false,
        message: "Icon not found in this category",
      });
    }

    // Remove icon from category's data array
    const updateResult = await iconsCollection.updateOne(
      {},
      {
        $pull: {
          [`icons.${categoryName}.data`]: iconUrl,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete icon from database",
      });
    }

    // Optionally: also delete the file from the filesystem
    const filePath = path.join(
      __dirname,
      "../public/icons",
      path.basename(iconUrl)
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      success: true,
      message: `Icon deleted successfully from category '${categoryName}'`,
    });
  } catch (err) {
    console.error("Error deleting icon:", err);
    res.status(500).json({
      success: false,
      message: "Server error during icon deletion",
    });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    await client.connect();
    const db = client.db("test");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({
      "users.username": username,
      "users.password": password,
    });

    if (user) {
      // Generate JWT token
      const token = jwt.sign(
        { username: username }, // payload
        JWT_SECRET, // secret key
        { expiresIn: "1d" } // expires in 1 day
      );

      // Send token in JSON so frontend can store it in localStorage
      return res.json({
        success: true,
        message: "Login successful",
        token,
      });
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const checkingAuth = (req, res) => {
  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, user: decoded });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
};

module.exports = {
  publicShowcaseIcons,
  getIconsCategories,
  addIconCategory,
  singleIconCategory,
  deleteIconCategory,
  uploadIcons,
  login,
  checkingAuth,
  deleteIcon,
};
