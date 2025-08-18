const express = require("express");

const PCT = require("../model/participants.js");
const DNT = require("../model/Donaters.js");
const ORG = require("../model/campOrganisers.js");

const { authMiddleware } = require("../middlewares/auth.js");
const { setUserReward } = require("../contractService/contract.js");

const router = express.Router();

router.post("/register", authMiddleware, async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: "eventId required" });

  try {
    // Check if this user is the organiser of the event
    const organiser = await ORG.findOne({ _id: eventId });
    if (!organiser) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (organiser.shortId === req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Organiser cannot register for own event" });
    }
    // check if user is already registered
    const existing = await PCT.findOne({ eventId, userId: req.user._id });
    if (existing) {
      return res
        .status(400)
        .json({ error: "Already registered for this event" });
    }

    // directly create the participant
    let participant = await PCT.create({
      eventId,
      userId: req.user._id,
    });

    // populate with user details if you want
    participant = await participant.populate("userId", "name email");

    res.status(201).json({ success: true, participant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/participants/:eventId", authMiddleware, async (req, res) => {
  const { eventId } = req.params;
  if (!eventId) return res.status(400).json({ error: "eventId required" });

  try {
    // find all participants for that event
    const participants = await PCT.find({ eventId })
      .populate("userId", "name email") // bring user details
      .sort({ registeredAt: 1 }); // optional: order by time

    res.status(200).json({ success: true, participants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// verify + reward participant
router.post("/verify/:participantId", authMiddleware, async (req, res) => {
  const { participantId } = req.params;
  if (!participantId)
    return res.status(400).json({ error: "eventId required" });

  try {
    // 1. Find participant
    const participant = await PCT.findById(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // 2. Prevent double verification
    if (participant.verified) {
      return res.status(400).json({ error: "Participant already verified" });
    }

    // 3. Get wallet address & current reward from DONATE collection
    const walletDoc = await DNT.findOne({
      shortId: participant.userId.toString(),
    });
    if (!walletDoc) {
      return res.status(404).json({ error: "Wallet not found for user" });
    }

    // 4. Call contract function to send tokens
    const rewardAmount = 10; // or 5, as you decide
    if (walletDoc.walletAddress) {
      await setUserReward(walletDoc.walletAddress, rewardAmount);
    }

    // 5. Mark participant as verified
    participant.verified = true;
    await participant.save();

    // 6. Update reward in DONATE schema
    walletDoc.reward = (walletDoc.reward || 0) + rewardAmount;
    await walletDoc.save();

    res.status(200).json({
      success: true,
      message: "Participant verified, rewarded and wallet updated",
      participant,
      walletDoc,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
