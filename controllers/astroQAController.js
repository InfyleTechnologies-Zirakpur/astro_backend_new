const mongoose = require("mongoose");
const Horoscope = require("../models/horoscope");
const User = require("../models/user");
const { askAstroQuestion } = require("../services/rag/ragService");
const { buildChartContextForQA } = require("../services/vedicAstrologyService");
const { calculateGunaMilan } = require("../services/gunaMilanService");

/**
 * POST /api/astro-qa/ask
 * body: { question: string, partnerId?: string }
 *
 * If partnerId is provided, grounds the answer in the compatibility
 * between the logged-in user and that partner (both must have a
 * Horoscope on file). Otherwise answers as a general knowledge-base
 * question (no personal chart data attached).
 */
const ask = async (req, res, next) => {
  try {
    const { question, partnerId } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ success: false, message: "question is required" });
    }
    if (question.length > 1000) {
      return res.status(400).json({ success: false, message: "question is too long (max 1000 characters)" });
    }

    let chartContext = null;

    if (partnerId) {
      if (!mongoose.isValidObjectId(partnerId)) {
        return res.status(400).json({ success: false, message: "Invalid partnerId" });
      }

      const [myHoroscope, partner, partnerHoroscope] = await Promise.all([
        Horoscope.findOne({ user: req.user._id }).lean(),
        User.findOne({ _id: partnerId, isActive: true }).select("name gender").lean(),
        Horoscope.findOne({ user: partnerId }).lean(),
      ]);

      if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });
      if (!myHoroscope || !partnerHoroscope) {
        return res.status(400).json({ success: false, message: "Both you and the partner must have a horoscope on file to ask a partner-specific question." });
      }

      let gunaMilan = null;
      const moonLonA = myHoroscope.vedicChart?.planets?.Moon?.longitude;
      const moonLonB = partnerHoroscope.vedicChart?.planets?.Moon?.longitude;
      if (Number.isFinite(moonLonA) && Number.isFinite(moonLonB)) {
        gunaMilan = calculateGunaMilan(moonLonA, moonLonB);
      }

      chartContext = buildChartContextForQA({
        chartA: myHoroscope.vedicChart,
        chartB: partnerHoroscope.vedicChart,
        gunaMilan,
      });
    } else {
      // General question — still attach the asker's own chart if they have
      // one on file, since most questions ("will I get married", "why do I
      // keep attracting the wrong people") are implicitly about themselves.
      const myHoroscope = await Horoscope.findOne({ user: req.user._id }).lean();
      if (myHoroscope?.vedicChart) {
        chartContext = buildChartContextForQA({ chartA: myHoroscope.vedicChart });
      }
    }

    const result = await askAstroQuestion(question.trim(), { chartContext });
    res.json({ success: true, message: "Answer generated", data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { ask };
