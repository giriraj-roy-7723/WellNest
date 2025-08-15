const express = require("express");
const DNT = require("../model/users.js");
const router = express.Router();
const { setUserReward } = require("../contractService/contract.js");

// PATCH /set
router.patch("/set", async (req, res) => {
  try {
    const { walletAddress, rewardAmount } = req.body;

    if (!walletAddress || !rewardAmount) {
      return res
        .status(400)
        .json({ error: "walletAddress and rewardAmount required" });
    }

    const updatedUser = await DNT.findOneAndUpdate(
      { walletAddress: walletAddress }, // match on wallet
      {
        $inc: { reward: rewardAmount }, // increment reward
        $setOnInsert: { walletAddress: walletAddress }, // set walletAddress if inserting
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const txHash = await setUserReward(walletAddress, rewardAmount);

    res.status(200).json({ success: true, txHash, user: updatedUser });
  } catch (error) {
    console.error("Error in /set route:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
