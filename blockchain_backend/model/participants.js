const { BlockscoutProvider } = require("ethers");
const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ORG",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  verified: {
    type: Boolean,
    default: false,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
});

const PCT = mongoose.model("participant", participantSchema);

module.exports = PCT;
