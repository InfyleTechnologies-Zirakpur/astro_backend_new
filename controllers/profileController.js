const Profile = require("../models/profile");

const profileFields = ["dateOfBirth", "currentCity", "education", "occupation", "relationshipGoal", "about"];
const buildProfileData = (body) => Object.fromEntries(profileFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const createProfile = async (req, res, next) => {
  try {
    const profile = await Profile.create({ user: req.user._id, ...buildProfileData(req.body), profileCompleted: true });
    res.status(201).json({ success: true, message: "Profile created", data: profile });
  } catch (error) { next(error); }
};
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, message: "Profile retrieved", data: profile });
  } catch (error) { next(error); }
};
const updateProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOneAndUpdate({ user: req.user._id }, { ...buildProfileData(req.body), profileCompleted: true }, { new: true, runValidators: true });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, message: "Profile updated", data: profile });
  } catch (error) { next(error); }
};
module.exports = { createProfile, getMyProfile, updateProfile };