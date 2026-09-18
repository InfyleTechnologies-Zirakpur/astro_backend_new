const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { ask } = require("../controllers/astroQAController");

const router = express.Router();
router.use(protect);
router.post("/ask", ask);

module.exports = router;
