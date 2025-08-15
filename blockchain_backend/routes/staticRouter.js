const express = require("express");
const DNT = require("../model/users.js");

const router = express.Router();

router.patch("/user/donate", async (req, res) => {
  console.log("Received body:", req.body); //Debug
  const { userId, reward } = req.body;

  try {
    // Update the user's reward if not found then insert
    const updatedUser = await DNT.findOneAndUpdate(
      { shortId: userId }, // search by your provided shortId
      { $inc: { reward: reward } }, // increment reward
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: "Reward updated", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
