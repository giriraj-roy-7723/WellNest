import NGOProfile from "../models/NGOProfile.js";
import User from "../models/User.js";

// Create or update NGO profile
export const upsertNGOProfile = async (req, res) => {
  try {
    const { orgName, registrationNumber, mission, website, email, services } = req.body;

    const profile = await NGOProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        orgName,
        registrationNumber,
        mission,
        website,
        email,
        services,
        isProfileComplete: true
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get NGO profile by logged-in user
export const getMyNGOProfile = async (req, res) => {
  try {
    const profile = await NGOProfile.findOne({ user: req.user.id }).populate("user", "email firstName lastName");
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Add a blog post
export const addBlog = async (req, res) => {
  try {
    const { title, body } = req.body;

    const profile = await NGOProfile.findOne({ user: req.user.id });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

    profile.blogs.push({ title, body });
    await profile.save();

    res.json({ success: true, data: profile.blogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all blogs for this NGO
export const getMyBlogs = async (req, res) => {
  try {
    const profile = await NGOProfile.findOne({ user: req.user.id });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

    res.json({ success: true, data: profile.blogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
