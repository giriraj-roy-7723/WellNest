import express from "express";
import { upsertNGOProfile, getMyNGOProfile, addBlog, getMyBlogs } from "../controllers/ngo.controller.js";
import { authRequired } from "../middlewares/auth.js";

import { Router } from "express";
const router = express.Router();

// Profile management
router.post("/profile", authRequired, upsertNGOProfile); // Create/Update
router.get("/profile", authRequired, getMyNGOProfile); // View

// Blogs
router.post("/blogs", authRequired, addBlog);
router.get("/blogs", authRequired, getMyBlogs);

export default router;
