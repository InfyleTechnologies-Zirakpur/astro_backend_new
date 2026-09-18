	const express = require("express");
	const { protect } = require("../middlewares/authMiddleware");
	const { calculateMatch, getMatch, getMyMatches, getRecommendations } = require("../controllers/matchmakingController");

	const router = express.Router();
	router.use(protect);
	router.post("/calculate", calculateMatch);
	router.get("/recommendations", getRecommendations);
	router.get("/my-matches", getMyMatches);
	router.get("/:matchId", getMatch);

	module.exports = router;
    