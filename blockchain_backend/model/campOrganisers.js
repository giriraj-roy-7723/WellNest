const mongoose = require("mongoose");

const organiserSchema = new mongoose.Schema(
  {
    //this id will be fetched from girirajs db
    shortId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      require: true,
    },
    location: {
      type: String,
      default: null,
    },
    locationURL: {
      type: String,
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ORG = mongoose.model("organiser", organiserSchema);

module.exports = ORG;
