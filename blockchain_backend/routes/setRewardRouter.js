const express = require("express");
const DNT = require("../model/users.js");
const router = express.Router();
const { setUserReward } = require("../contractService/contract.js");
const { authMiddleware } = require("../middlewares/auth"); // your new auth middleware

// PATCH /set
router.patch("/set", authMiddleware, async (req, res) => {
  try {
    const { walletAddress} = req.body;

    if (!walletAddress) {
      return res
        .status(400)
        .json({ error: "walletAddress required" });
    }

    const userId = req.user._id.toString();

    const updatedUser = await DNT.findOneAndUpdate(
      { shortId: userId }, // search by logged-in user's ID
      {
        $set: { walletAddress: walletAddress }, // always update walletAddress
        $setOnInsert: { shortId: userId }, // only set shortId if new
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    

    const txHash = await setUserReward(walletAddress, updatedUser.reward);

    res.status(200).json({ success: true, txHash, user: updatedUser });
  } catch (error) {
    console.error("Error in /set route:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
