const mongoose = require("mongoose");
const User = require("../models/user");
const Profile = require("../models/profile");
const Questionnaire = require("../models/questionnaire");
const Match = require("../models/match");
const Horoscope = require("../models/horoscope");
const { calculateCompatibility } = require("../services/compatibilityService");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isCompleteQuestionnaire = (questionnaire) => Questionnaire.fields.every((field) => typeof questionnaire?.[field] === "string" && questionnaire[field].trim());

const parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const getCompatibilityInputs = async (userId) => Promise.all([
  Profile.findOne({ user: userId }),
  Questionnaire.findOne({ user: userId }),
  Horoscope.findOne({ user: userId }),
]);

const orderedUsers = (first, second) => String(first) < String(second) ? [first, second] : [second, first];

const calculateMatch = async (req, res, next) => {
  try {
    const { partnerId } = req.body;
    if (!mongoose.isValidObjectId(partnerId)) return res.status(400).json({ success: false, message: "Invalid partnerId" });
    if (String(req.user._id) === String(partnerId)) return res.status(400).json({ success: false, message: "You cannot match with yourself" });

    const partner = await User.findOne({ _id: partnerId, isActive: true });
    if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });

    const [[profileA, questionnaireA, horoscopeA], [profileB, questionnaireB, horoscopeB]] = await Promise.all([
      getCompatibilityInputs(req.user._id),
      getCompatibilityInputs(partner._id),
    ]);
    if (!profileA?.profileCompleted || !profileB?.profileCompleted) return res.status(400).json({ success: false, message: "Both users must complete their profiles before compatibility can be calculated." });
    if (!questionnaireA?.isComplete() || !questionnaireB?.isComplete()) return res.status(400).json({ success: false, message: "Both users must complete their compatibility questionnaire before calculating the match." });
    // Horoscope is optional: if only one (or neither) user has submitted
    // one, the astrology category is simply omitted from the report.

    const [userA, userB] = orderedUsers(req.user._id, partner._id);
    const report = calculateCompatibility({ profileA, questionnaireA, profileB, questionnaireB, horoscopeA, horoscopeB });
    const match = await Match.findOneAndUpdate(
      { userA, userB },
      { $set: { userA, userB, ...report } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: "Compatibility calculated", data: match });
  } catch (error) { next(error); }
};

const getMatch = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.matchId)) return res.status(400).json({ success: false, message: "Invalid matchId" });
    const match = await Match.findById(req.params.matchId).populate("userA", "name email gender").populate("userB", "name email gender");
    if (!match) return res.status(404).json({ success: false, message: "Match not found" });
    if (!match.userA || !match.userB) return res.status(404).json({ success: false, message: "Match participants no longer exist" });
    if (![String(match.userA._id), String(match.userB._id)].includes(String(req.user._id))) return res.status(403).json({ success: false, message: "You are not a participant in this match" });
    res.json({ success: true, message: "Match retrieved", data: match });
  } catch (error) { next(error); }
};

const getMyMatches = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { $or: [{ userA: req.user._id }, { userB: req.user._id }] };
    const [matches, total] = await Promise.all([
      Match.find(filter).populate("userA", "name gender").populate("userB", "name gender").sort({ score: -1, updatedAt: -1 }).skip(skip).limit(limit),
      Match.countDocuments(filter),
    ]);
    res.json({ success: true, message: "Matches retrieved", data: matches, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getRecommendations = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const [myProfile, myQuestionnaire, myHoroscope] = await getCompatibilityInputs(req.user._id);
    if (!myProfile?.profileCompleted || !myQuestionnaire?.isComplete()) {
      return res.status(400).json({ success: false, message: "Complete your profile and compatibility questionnaire before viewing recommendations." });
    }

    const profileFilter = { profileCompleted: true };
    if (req.query.city) profileFilter.currentCity = new RegExp(`^${escapeRegExp(String(req.query.city).trim())}$`, "i");
    if (req.query.relationshipGoal) profileFilter.relationshipGoal = req.query.relationshipGoal;
    const profiles = await Profile.find(profileFilter).select("user dateOfBirth currentCity occupation education relationshipGoal about").lean();
    const candidateIds = profiles.map((profile) => profile.user).filter((id) => String(id) !== String(req.user._id));
    const userFilter = { _id: { $in: candidateIds }, isActive: true };
    if (req.query.gender) userFilter.gender = req.query.gender;
    const [users, questionnaires, horoscopes] = await Promise.all([
      User.find(userFilter).select("name gender").lean(),
      Questionnaire.find({ user: { $in: candidateIds } }).lean(),
      Horoscope.find({ user: { $in: candidateIds } }).lean(),
    ]);
    const userById = new Map(users.map((user) => [String(user._id), user]));
    const questionnaireById = new Map(questionnaires.map((item) => [String(item.user), item]));
    const horoscopeById = new Map(horoscopes.map((item) => [String(item.user), item]));
    const recommendations = profiles
      .filter((profile) => userById.has(String(profile.user)) && isCompleteQuestionnaire(questionnaireById.get(String(profile.user))))
      .map((profile) => {
        const user = userById.get(String(profile.user));
        const report = calculateCompatibility({ profileA: myProfile, questionnaireA: myQuestionnaire, horoscopeA: myHoroscope, profileB: profile, questionnaireB: questionnaireById.get(String(profile.user)), horoscopeB: horoscopeById.get(String(profile.user)) });
        return { user, profile, compatibility: { score: report.score, label: report.overallLabel, conclusion: report.overallConclusion, strengths: report.strengths } };
      })
      .sort((first, second) => second.compatibility.score - first.compatibility.score);
    const total = recommendations.length;
    res.json({ success: true, message: "Recommendations retrieved", data: recommendations.slice(skip, skip + limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

module.exports = { calculateMatch, getMatch, getMyMatches, getRecommendations };