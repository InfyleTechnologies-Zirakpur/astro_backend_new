const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { createProfile, getMyProfile, updateProfile } = require("../controllers/profileController");

const router = express.Router();
router.use(protect);
router.post("/", createProfile);
router.get("/me", getMyProfile);
router.put("/", updateProfile);
module.exports = router;