const mongoose = require("mongoose");

const outbreakSchema = new mongoose.Schema(
  {
    verifiedBy: {
      type: String,
      trim: true,
      default: null,
    },
    submittedBy: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [
          /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
          "Please enter a valid email",
        ],
      },
      phoneNumber: {
        type: String,
        trim: true,
        match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"],
      },
    },

    location: {
      country: {
        type: String,
        required: true,
        trim: true,
        index: true,
        lowercase: true,
        maxlength: 100,
      },
      state: {
        type: String,
        required: true,
        trim: true,
        index: true,
        lowercase: true,
        maxlength: 100,
      },
      district: {
        type: String,
        required: true,
        trim: true,
        index: true,
        lowercase: true,
        maxlength: 100,
      },
      pincode: {
        type: String,
        trim: true,
        match: [/^\d{5,6}$/, "Please enter a valid pincode"],
      },

      // Google Maps Integration
      googleMapsLink: {
        type: String,
        trim: true,
        // match: [
        //   /^https:\/\/(www\.)?google\.com\/maps\/.*$/,
        //   "Please enter a valid Google Maps link",
        // ],
        required: true,
      },
    },

    // Individual components that make up the combined description
    descriptionComponents: {
      reportType: {
        type: String,
        required: true,
        lowercase: true,
        enum: ["outbreak", "health_survey", "emergency"],
        index: true,
      },

      diseaseCategory: {
        type: String,
        required: true,
        lowercase: true,
        index: true,
      },
      suspectedCases: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      basicInfo: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 1000,
      },
      symptoms: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 100,
      },
      additionalNotes: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 1000,
      },
    },
    severity: {
      type: String,
      enum: ["low", "moderate", "high", "critical"],
      lowercase: true,
      required: true,
      default: "moderate",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tampered: {
      type: Boolean,
      default: false,
    },
    images: {
      type: [String],
      required: true,
      validate: [arrayLimit, "{PATH} must have at least one image"],
    },
  },
  {
    timestamps: true,
  }
);

function arrayLimit(val) {
  return val.length > 0;
}
const OUT = mongoose.model("outbreakinfo", outbreakSchema);

module.exports = OUT;
