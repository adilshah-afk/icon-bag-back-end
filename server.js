const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const {
  getIconsCategories,
  addIconCategory,
  singleIconCategory,
  deleteIconCategory,
  uploadIcons,
  login,
  checkingAuth,
} = require("./Controller/Controller");

const authMiddleware = require("./middlewares/authMiddleware");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://192.168.0.105:8081",
  "https://*.expo.dev",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(cookieParser());

const url = "mongodb://localhost:27017/admin";
const client = new MongoClient(url);
const JWT_SECRET = "your_super_secret_key"; // Change this to something secure

// Ensure the public/icons directory exists
const iconsDir = path.join(__dirname, "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/icons/"); // Store in public/icons directory
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp + random number + original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, "icon-" + uniqueSuffix + extension);
  },
});

// File filter to accept only image files
const fileFilter = (req, file, cb) => {
  console.log("File filter check:", file.mimetype);
  // Accept image files and SVG files
  if (file.mimetype.startsWith("image/") || file.mimetype === "image/svg+xml") {
    cb(null, true);
  } else {
    console.log("File rejected:", file.mimetype);
    cb(new Error("Only image files are allowed!"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  console.log("Multer Error:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field",
      });
    }
  }

  if (err.message === "Only image files are allowed!") {
    return res.status(400).json({
      success: false,
      message: "Only image files are allowed",
    });
  }

  return res.status(500).json({
    success: false,
    message: "File upload error",
    error: err.message,
  });
};

// ===================== API endpoints ======================== //
// uploading icon
app.post(
  "/icon-category/:name/upload",
  upload.array("icons"),
  authMiddleware,
  handleMulterError,
  uploadIcons
);

// Login
app.post("/login", login);

// Check auth route
app.get("/check-auth", checkingAuth);

// Add category
app.post("/add-icon-category", authMiddleware, addIconCategory);

// List Of Categories (full objects)
app.get("/icon-categories", authMiddleware, getIconsCategories);

// Get a Single Category
app.get("/icon-category/:name", authMiddleware, singleIconCategory);

//Deleting
app.patch("/delete-icon-category", authMiddleware, deleteIconCategory);

app.use("/icons", express.static("public/icons"));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
