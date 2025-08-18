const express = require("express");
const ORG = require("../model/campOrganisers.js");
const { authMiddleware,restrictRole } = require("../middlewares/auth.js"); // your new auth middleware

const router = express.Router();
router.use(authMiddleware);
router.patch("/set",restrictRole(["ngo", "health_worker"]), async (req, res) => {
  if (
    !req.user ||
    !req.user.email ||
    !req.user.firstName ||
    !req.user.lastName ||
    !req.user.role ||
    !req.body ||
    !req.body.location ||
    !req.body.locationURL ||
    !req.body.date ||
    !req.body.startTime ||
    !req.body.endTime
  ) {
    return res.status(400).json({ error: "ALL flags are required" });
  }
  console.log("Received body:", req.body); // Debug
  console.log(req.user);

  try {
    // Use req.user._id to identify the currently logged-in user
    const updatedOrg = await ORG.findOneAndUpdate(
      { shortId: req.user._id.toString() }, // match organiser by shortId
      {
        $set: {
          name: req.user.firstName + " " + req.user.lastName,
          email: req.user.email,
          role: req.user.role,
          location: req.body.location,
          locationURL: req.body.locationURL,
          date: req.body.date,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
        },
        $setOnInsert: {
          shortId: req.user._id.toString(), // only set when creating
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, updatedOrg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/delete",restrictRole(["ngo", "health_worker"]), async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(400).json({ error: "ALL flags are required" });
  }
  console.log(req.user);
  try {
    // Use req.user._id to identify the currently logged-in user
    const deletedOrg = await ORG.findOneAndDelete({
      shortId: req.user._id.toString(),
    });
    if (!deletedOrg) {
      return res.status(404).json({ error: "Organiser not found" });
    }

    res.status(200).json({ success: true, deletedOrg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/all", async (req, res) => {
  try {
    const orgs = await ORG.find(); // fetch ALL organisers/events
    res.status(200).json({ success: true, orgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
