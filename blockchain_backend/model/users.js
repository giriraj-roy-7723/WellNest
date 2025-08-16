const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    //this id will be fetched from girirajs db
    shortId: {
      type: String,
      required: true,
      unique: true,
    },
    reward: {
      type: Number,
      default: 0,
    },
    walletAddress: {
      type: String,
      default: "0x",
    },
  },
  {
    timestamps: true,
  }
);

const DNT = mongoose.model("Donate", urlSchema);

module.exports = DNT;
