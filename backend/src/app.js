import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import publicRoutes from "./routes/public.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import mongoose from "mongoose";
import { validationResult } from "express-validator";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: false,
  })
);

app.use(express.json());
app.use(morgan("dev"));

// Simple validator middleware for express-validator
app.use((req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: errors.array(),
    });
  }
  next();
});

// Routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/", publicRoutes);

// Health check
app.get("/health", (req, res) => res.json({ success: true, message: "OK" }));

// Error handler
app.use(errorHandler);

// Start
const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGODB_URI)
  .then(() =>
    app.listen(PORT, () =>
      console.log(` API running on http://localhost:${PORT}`)
    )
  )
  .catch((e) => {
    console.error("Mongo connect failed", e);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  process.exit(0);
});

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import ngoRoutes from "./routes/ngo.routes.js";

app.use("/ngo", ngoRoutes);

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import doctorRoutes from "./routes/doctor.routes.js";

app.use("/doctor", doctorRoutes); // /doctor/profile
// public routes already mounted as app.use("/", publicRoutes)

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import healthworkerRoutes from "./routes/healthworker.routes.js";
app.use("/healthworker", healthworkerRoutes);

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import patientRoutes from "./routes/patient.routes.js";
app.use("/patient", patientRoutes);

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
import appointmentRouter from "./routes/appointmentRouter.js";
app.use("/appointment",appointmentRouter)