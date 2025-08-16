const express = require("express");
const DNT = require("../model/users.js");
const { authMiddleware } = require("../middlewares/auth"); // your new auth middleware

const router = express.Router();

router.patch("/user/donate", authMiddleware, async (req, res) => {
  console.log("Received body:", req.body); // Debug
  console.log(req.user);
  const reward = req.body.reward;
  if (!reward)
    return res.status(400).json({ error: "Reward amount is required" });

  try {
    // Use req.user._id to identify the currently logged-in user
    const updatedUser = await DNT.findOneAndUpdate(
      { shortId: req.user._id.toString() }, // current logged-in user's ID
      { $inc: { reward: reward } }, // increment reward
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: "Reward updated", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
