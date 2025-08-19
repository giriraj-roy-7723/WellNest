const express = require("express");
const ORG = require("../model/campOrganisers.js");
const PCT = require("../model/participants.js");

const { authMiddleware, restrictRole } = require("../middlewares/auth.js"); // your new auth middleware

const router = express.Router();
router.use(authMiddleware);
router.post(
  "/set",
  restrictRole(["ngo", "health_worker"]),
  async (req, res) => {
    const {
      location,
      locationURL,
      date,
      startTime,
      endTime,
      eventType,
      customEventName,
    } = req.body;

    if (
      !req.user ||
      !req.user.email ||
      !req.user.firstName ||
      !req.user.lastName ||
      !req.user.role ||
      !location ||
      !locationURL ||
      !date ||
      !startTime ||
      !endTime ||
      !eventType ||
      (eventType === "Other" && !customEventName)
    ) {
      return res
        .status(400)
        .json({ error: "All required fields must be provided" });
    }

    try {
      const updatedOrg = await ORG.findOneAndUpdate(
        { shortId: req.user._id.toString() }, // match organiser by shortId
        {
          $set: {
            name: req.user.firstName + " " + req.user.lastName,
            email: req.user.email,
            role: req.user.role,
            location,
            locationURL,
            date,
            startTime,
            endTime,
            eventType,
            customEventName: eventType === "Other" ? customEventName : null,
          },
          $setOnInsert: {
            shortId: req.user._id.toString(), // only set when creating
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      console.log(updatedOrg);
      res.status(200).json({ success: true, updatedOrg });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.patch(
  "/delete/:eventId",
  restrictRole(["ngo", "health_worker"]),
  async (req, res) => {
    if (!req.user || !req.user._id) {
      return res.status(400).json({ error: "ALL flags are required" });
    }
    const { eventId } = req.params;
    if(!eventId)
      return res.status(400).json({ error: "eventId required" });

    console.log("Delete Called");
    try {
      // Delete the organiser's event
      const deletedOrg = await ORG.findOneAndDelete({
        _id:eventId,
      });

      if (!deletedOrg) {
        return res.status(404).json({ error: "Organiser not found" });
      }

      //  Cascade delete all participants of this event
      await PCT.deleteMany({ eventId: deletedOrg._id });

      res.status(200).json({
        success: true,
        message: "Event and all related participants deleted successfully",
        deletedOrg,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get("/all", async (req, res) => {
  try {
    const orgs = await ORG.find(); // fetch ALL organisers/events
    res.status(200).json({ success: true, orgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
