const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    currentCity: {
      type: String,
      required: true,
      trim: true,
    },

    occupation: {
      type: String,
      required: true,
      trim: true,
    },

    education: {
      type: String,
      required: true,
      trim: true,
    },

    relationshipGoal: {
      type: String,
      enum: [
        "marriage",
        "serious_relationship",
        "long_term_relationship",
        "not_sure",
      ],
      required: true,
    },

    about: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

profileSchema.index({ profileCompleted: 1, relationshipGoal: 1, currentCity: 1 });

module.exports = mongoose.model("Profile", profileSchema);