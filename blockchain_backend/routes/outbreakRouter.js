const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// const DNT = require("../model/Donaters.js");
const OUT = require("../model/outbreakRecords.js");

const { authMiddleware, restrictRole } = require("../middlewares/auth.js");

const {
  submitHealthReport,
  verifyHealthReport,
  getReportDetails,
  createDataHash,
} = require("../contractService/Outbreak_contract.js");
const { setUserReward } = require("../contractService/Token_contract.js");

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "outbreak-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Maximum 5 files
  },
});

// Helper function to verify data integrity against blockchain (unchanged)
const verifyDataIntegrity = async (localRecord) => {
  try {
    // Create the expected data hash from local record - MUST MATCH the structure used when submitting
    const expectedData = JSON.stringify({
      reportType: localRecord.descriptionComponents.reportType.toLowerCase(),
      location: {
        country: localRecord.location.country.toLowerCase(),
        state: localRecord.location.state.toLowerCase(),
        district: localRecord.location.district.toLowerCase(),
        pincode: localRecord.location.pincode.toLowerCase() || "",
      },
      outbreakData: {
        diseaseCategory:
          localRecord.descriptionComponents.diseaseCategory.toLowerCase(),
        suspectedCases: localRecord.descriptionComponents.suspectedCases,
        severity: localRecord.severity.toLowerCase(),
        basicInfo:
          localRecord.descriptionComponents.basicInfo.toLowerCase() || "",
        symptoms:
          localRecord.descriptionComponents.symptoms.toLowerCase() || "",
        additionalNotes:
          localRecord.descriptionComponents.additionalNotes.toLowerCase() || "",
      },
    });
    console.log("Expected Data:", expectedData);
    const expectedHash = createDataHash(expectedData);

    try {
      // Try to get blockchain data
      const blockchainData = await getReportDetails(expectedHash);
      console.log("Blockchain data:", blockchainData);
      console.log("Local record data:", {
        reportType: localRecord.descriptionComponents.reportType,
        country: localRecord.location.country,
        state: localRecord.location.state,
        district: localRecord.location.district,
        submittedBy: localRecord.submittedBy.name,
      });

      // If we get data back, compare key fields - both should be lowercase for comparison
      const isIntegrityValid =
        blockchainData.reportType.toLowerCase() ===
          localRecord.descriptionComponents.reportType.toLowerCase() &&
        blockchainData.location.country.toLowerCase() ===
          localRecord.location.country.toLowerCase() &&
        blockchainData.location.state.toLowerCase() ===
          localRecord.location.state.toLowerCase() &&
        blockchainData.location.district.toLowerCase() ===
          localRecord.location.district.toLowerCase() &&
        blockchainData.submittedBy.toLowerCase() ===
          localRecord.submittedBy.name.toLowerCase();

      console.log("Integrity check result:", isIntegrityValid);

      return {
        tampered: !isIntegrityValid,
        blockchainExists: true,
        verificationDetails: {
          expectedHash,
          blockchainData: isIntegrityValid ? blockchainData : null,
        },
      };
    } catch (blockchainError) {
      // If blockchain data doesn't exist, mark as potentially tampered
      console.warn(
        `Blockchain data not found for record ${localRecord._id}:`,
        blockchainError.message
      );
      return {
        tampered: true,
        blockchainExists: false,
        verificationDetails: {
          expectedHash,
          error: "Blockchain record not found",
        },
      };
    }
  } catch (error) {
    console.error("Error verifying data integrity:", error);
    return {
      tampered: true,
      blockchainExists: false,
      verificationDetails: {
        error: "Verification process failed",
      },
    };
  }
};

// Helper function to verify and update multiple records (unchanged)
const verifyAndUpdateRecords = async (records) => {
  const verifiedRecords = [];

  for (const record of records) {
    const verification = await verifyDataIntegrity(record);

    // Update the database record if tampered status changed
    if (record.tampered !== verification.tampered) {
      await OUT.findByIdAndUpdate(record._id, {
        tampered: verification.tampered,
      });
      record.tampered = verification.tampered;
    }

    // Add verification info to the record
    const recordWithVerification = {
      ...record,
      verificationStatus: verification.tampered
        ? "POTENTIALLY_TAMPERED"
        : "VERIFIED",
      blockchainExists: verification.blockchainExists,
      lastVerified: new Date(),
    };

    verifiedRecords.push(recordWithVerification);
  }

  return verifiedRecords;
};

// Submit outbreak report (with token reward for authenticated users) - UPDATED WITH IMAGE UPLOAD
router.post(
  "/submit",
  authMiddleware,
  upload.array("images", 5),
  async (req, res) => {
    try {
      // Parse JSON strings from FormData
      let location, descriptionComponents, severity, submittedBy;
      
      try {
        location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
        descriptionComponents = typeof req.body.descriptionComponents === 'string' ? JSON.parse(req.body.descriptionComponents) : req.body.descriptionComponents;
        severity = req.body.severity;
        submittedBy = typeof req.body.submittedBy === 'string' ? JSON.parse(req.body.submittedBy) : req.body.submittedBy;
      } catch (parseError) {
        console.error("Error parsing FormData JSON:", parseError);
        return res.status(400).json({
          success: false,
          message: "Invalid data format. Please check your form submission.",
          error: parseError.message
        });
      }
      
      const { userId, email } = req.user; // from auth middleware
      const uploadedFiles = req.files || [];

      // Validate required fields
      if (!location || !descriptionComponents || !severity) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: location, descriptionComponents, severity",
        });
      }

      // Validate location fields
      if (
        !location.country ||
        !location.state ||
        !location.district ||
        !location.googleMapsLink
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Location must include country, state, district, and googleMapsLink",
        });
      }

      // Validate description components
      if (
        !descriptionComponents.reportType ||
        !descriptionComponents.diseaseCategory ||
        descriptionComponents.suspectedCases === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Description components must include reportType, diseaseCategory, and suspectedCases",
        });
      }

      // Process uploaded images
      const imagePaths = uploadedFiles.map(
        (file) => `/uploads/${file.filename}`
      );

      // Debug logging
      console.log("Parsed data from authenticated FormData:", {
        location,
        descriptionComponents,
        severity,
        submittedBy,
        imageCount: uploadedFiles.length
      });

      // Create the actual data string for hashing (blockchain data)
      const actualData = JSON.stringify({
        reportType: descriptionComponents.reportType.toLowerCase(),
        location: {
          country: location.country.toLowerCase(),
          state: location.state.toLowerCase(),
          district: location.district.toLowerCase(),
          pincode: location.pincode.toLowerCase() || "",
        },
        outbreakData: {
          diseaseCategory: descriptionComponents.diseaseCategory.toLowerCase(),
          suspectedCases: descriptionComponents.suspectedCases,
          severity: severity.toLowerCase(),
          basicInfo: descriptionComponents.basicInfo.toLowerCase() || "",
          symptoms: descriptionComponents.symptoms.toLowerCase() || "",
          additionalNotes:
            descriptionComponents.additionalNotes.toLowerCase() || "",
        },
      });
      console.log("Actual Data:", actualData);

      // Save to local database with complete schema structure including images
      const outbreakRecord = await OUT.create({
        submittedBy: {
          name: submittedBy?.name || "Authenticated User",
          email: email,
          phoneNumber: submittedBy?.phoneNumber || "",
        },
        location: {
          country: location.country,
          state: location.state,
          district: location.district,
          pincode: location.pincode || "",
          googleMapsLink: location.googleMapsLink,
        },
        descriptionComponents: {
          reportType: descriptionComponents.reportType,
          diseaseCategory: descriptionComponents.diseaseCategory,
          suspectedCases: descriptionComponents.suspectedCases,
          basicInfo: descriptionComponents.basicInfo || "",
          symptoms: descriptionComponents.symptoms || "",
          additionalNotes: descriptionComponents.additionalNotes || "",
        },
        severity: severity,
        isActive: true,
        verifiedBy: "",
        tampered: false,
        images: imagePaths, // Add image paths to database
      });
      // Submit to blockchain
      const blockchainResult = await submitHealthReport({
        submittedBy: submittedBy?.name || userId,
        email: email,
        reportType: descriptionComponents.reportType,
        location: {
          country: location.country,
          state: location.state,
          district: location.district,
          pincode: location.pincode || "",
        },
        actualData: actualData,
      });
      res.status(201).json({
        success: true,
        message:
          "Outbreak report submitted successfully! You've been rewarded 5 tokens.",
        data: {
          reportId: outbreakRecord._id,
          dataHash: blockchainResult.dataHash,
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          tokensRewarded: 5,
          verificationStatus: "NOT VERIFIED",
          imagesUploaded: imagePaths.length,
          reportDetails: {
            reportType: descriptionComponents.reportType,
            diseaseCategory: descriptionComponents.diseaseCategory,
            suspectedCases: descriptionComponents.suspectedCases,
            severity: severity,
            location:
              location.country +
              ", " +
              location.state +
              ", " +
              location.district,
            images: imagePaths,
          },
        },
      });
    } catch (error) {
      console.error("Error submitting outbreak report:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit outbreak report",
        error: error.message,
      });
    }
  }
);

// Submit outbreak report for non-authenticated users (no reward) - UPDATED WITH IMAGE UPLOAD
router.post("/submit-public", upload.array("images", 5), async (req, res) => {
  try {
    // Parse JSON strings from FormData
    let submittedBy, location, descriptionComponents, severity;
    
    try {
      submittedBy = typeof req.body.submittedBy === 'string' ? JSON.parse(req.body.submittedBy) : req.body.submittedBy;
      location = typeof req.body.location === 'string' ? JSON.parse(req.body.location) : req.body.location;
      descriptionComponents = typeof req.body.descriptionComponents === 'string' ? JSON.parse(req.body.descriptionComponents) : req.body.descriptionComponents;
      severity = req.body.severity;
    } catch (parseError) {
      console.error("Error parsing FormData JSON:", parseError);
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Please check your form submission.",
        error: parseError.message
      });
    }
    
    const uploadedFiles = req.files || [];

    // Validate required fields
    if (
      !submittedBy ||
      !submittedBy.name ||
      !submittedBy.email ||
      !location ||
      !descriptionComponents ||
      !severity
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: submittedBy (name, email), location, descriptionComponents, severity",
      });
    }

    // Validate location fields
    if (
      !location.country ||
      !location.state ||
      !location.district ||
      !location.googleMapsLink
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Location must include country, state, district, and googleMapsLink",
      });
    }

    // Validate description components
    if (
      !descriptionComponents.reportType ||
      !descriptionComponents.diseaseCategory ||
      descriptionComponents.suspectedCases === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description components must include reportType, diseaseCategory, and suspectedCases",
      });
    }

    // Process uploaded images
    const imagePaths = uploadedFiles.map((file) => `/uploads/${file.filename}`);

    // Debug logging
    console.log("Parsed data from FormData:", {
      submittedBy,
      location,
      descriptionComponents,
      severity,
      imageCount: uploadedFiles.length
    });

    // Create the actual data string for hashing (blockchain data)
    const actualData = JSON.stringify({
      reportType: descriptionComponents.reportType.toLowerCase(),
      location: {
        country: location.country.toLowerCase(),
        state: location.state.toLowerCase(),
        district: location.district.toLowerCase(),
        pincode: location.pincode.toLowerCase() || "",
      },
      outbreakData: {
        diseaseCategory: descriptionComponents.diseaseCategory.toLowerCase(),
        suspectedCases: descriptionComponents.suspectedCases,
        severity: severity.toLowerCase(),
        basicInfo: descriptionComponents.basicInfo.toLowerCase() || "",
        symptoms: descriptionComponents.symptoms.toLowerCase() || "",
        additionalNotes:
          descriptionComponents.additionalNotes.toLowerCase() || "",
      },
    });

    // Submit to blockchain
    const blockchainResult = await submitHealthReport({
      submittedBy: submittedBy.name.toLowerCase(),
      email: submittedBy.email.toLowerCase(),
      reportType: descriptionComponents.reportType.toLowerCase(),
      location: {
        country: location.country.toLowerCase(),
        state: location.state.toLowerCase(),
        district: location.district.toLowerCase(),
        pincode: location.pincode.toLowerCase() || "",
      },
      actualData: actualData,
    });

    // Save to local database including images
    const outbreakRecord = await OUT.create({
      submittedBy: {
        name: submittedBy.name.toLowerCase(),
        email: submittedBy.email.toLowerCase(),
        phoneNumber: submittedBy.phoneNumber.toLowerCase() || "",
      },
      location: {
        country: location.country.toLowerCase(),
        state: location.state.toLowerCase(),
        district: location.district.toLowerCase(),
        pincode: location.pincode.toLowerCase() || "",
        googleMapsLink: location.googleMapsLink.toLowerCase(),
      },
      descriptionComponents: {
        reportType: descriptionComponents.reportType.toLowerCase(),
        diseaseCategory: descriptionComponents.diseaseCategory.toLowerCase(),
        suspectedCases: descriptionComponents.suspectedCases,
        basicInfo: descriptionComponents.basicInfo.toLowerCase() || "",
        symptoms: descriptionComponents.symptoms.toLowerCase() || "",
        additionalNotes:
          descriptionComponents.additionalNotes.toLowerCase() || "",
      },
      severity: severity,
      isActive: true,
      verifiedBy: "",
      tampered: false,
      images: imagePaths, // Add image paths to database
    });

    res.status(201).json({
      success: true,
      message: "Outbreak report submitted successfully!",
      data: {
        reportId: outbreakRecord._id,
        dataHash: blockchainResult.dataHash,
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
        verificationStatus: "VERIFIED",
        imagesUploaded: imagePaths.length,
        reportDetails: {
          reportType: descriptionComponents.reportType,
          diseaseCategory: descriptionComponents.diseaseCategory,
          suspectedCases: descriptionComponents.suspectedCases,
          severity: severity,
          location:
            location.country + ", " + location.state + ", " + location.district,
          images: imagePaths,
        },
      },
    });
  } catch (error) {
    console.error("Error submitting public outbreak report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit outbreak report",
      error: error.message,
    });
  }
});

// Verify outbreak report (authenticated users only)
router.patch(
  "/verify/:reportId",
  authMiddleware,
  restrictRole(["ngo", "health_worker"]),
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const userId = req.user._id;

      // Find the local record first
      const localRecord = await OUT.findById(reportId);
      if (!localRecord) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Verify data integrity before verification
      const verification = await verifyDataIntegrity(localRecord);

      if (verification.tampered) {
        await OUT.findByIdAndUpdate(reportId, { tampered: true });
        return res.status(400).json({
          success: false,
          message:
            "Cannot verify a potentially tampered report. Please investigate the data integrity first.",
          verificationStatus: "POTENTIALLY_TAMPERED",
        });
      }

      // Create data hash from the report data for blockchain verification
      const actualData = JSON.stringify({
        reportType: localRecord.descriptionComponents.reportType.toLowerCase(),
        location: {
          country: localRecord.location.country.toLowerCase(),
          state: localRecord.location.state.toLowerCase(),
          district: localRecord.location.district.toLowerCase(),
          pincode: localRecord.location.pincode.toLowerCase() || "",
        },
        outbreakData: {
          diseaseCategory:
            localRecord.descriptionComponents.diseaseCategory.toLowerCase(),
          suspectedCases: localRecord.descriptionComponents.suspectedCases,
          severity: localRecord.severity.toLowerCase(),
          basicInfo:
            localRecord.descriptionComponents.basicInfo.toLowerCase() || "",
          symptoms:
            localRecord.descriptionComponents.symptoms.toLowerCase() || "",
          additionalNotes:
            localRecord.descriptionComponents.additionalNotes.toLowerCase() ||
            "",
        },
        //   submittedAt: localRecord.createdAt.toISOString(),
      });

      const dataHash = createDataHash(actualData);
      console.log(userId);
      // Verify on blockchain
      const verificationResult = await verifyHealthReport(
        dataHash,
        String(userId)
      );
      // Update local database
      await OUT.findOneAndUpdate(
        { _id: reportId }, // filter
        { verifiedBy: userId }, // update
        { new: true } // return the updated document if needed
      );

      res.status(200).json({
        success: true,
        message: "Report verified successfully",
        data: {
          ...verificationResult,
          reportId: reportId,
          verifiedBy: userId,
          verificationStatus: "VERIFIED",
        },
      });
    } catch (error) {
      console.error("Error verifying report:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify report",
        error: error.message,
      });
    }
  }
);

// Get reports by country with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/country/:country", async (req, res) => {
  try {
    const { country } = req.params;
    const {
      page = 1,
      limit = 10,
      severity,
      diseaseCategory,
      reportType,
      isActive = "true",
      skipVerification = "false",
    } = req.query;

    // Normalize country string
    const normalizedCountry = country.toLowerCase().trim();

    // Build filter object
    const filter = {
      "location.country": normalizedCountry,
      //   isActive: isActive === "true",
    };
    if (severity) filter.severity = severity;
    if (diseaseCategory)
      filter["descriptionComponents.diseaseCategory"] = diseaseCategory;
    if (reportType) filter["descriptionComponents.reportType"] = reportType;

    // Fetch reports
    let reports = await OUT.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = reports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(reports);
    }

    // Shape response including images
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        country: normalizedCountry,
        totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting reports by country:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reports by country",
      error: error.message,
    });
  }
});

// Get specific report details with blockchain verification
router.get("/details/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { skipVerification = false } = req.query;

    const reportDetails = await OUT.findById(reportId);

    if (!reportDetails) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    let response = { success: true, data: reportDetails };

    // Verify blockchain integrity unless explicitly skipped
    if (skipVerification !== "true") {
      const verification = await verifyDataIntegrity(reportDetails);

      // Update database if tampered status changed
      if (reportDetails.tampered !== verification.tampered) {
        await OUT.findByIdAndUpdate(reportId, {
          tampered: verification.tampered,
        });
        reportDetails.tampered = verification.tampered;
      }

      response.data = {
        ...reportDetails.toObject(),
        verificationStatus: verification.tampered
          ? "POTENTIALLY_TAMPERED"
          : "VERIFIED",
        blockchainExists: verification.blockchainExists,
        lastVerified: new Date(),
        verificationDetails: verification.verificationDetails,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting report details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get report details",
      error: error.message,
    });
  }
});
// Get reports by state with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/state/:state", async (req, res) => {
  try {
    const { state } = req.params;
    const {
      page = 1,
      limit = 10,
      severity,
      diseaseCategory,
      reportType,
      isActive = "true",
      skipVerification = "false",
    } = req.query;

    const filter = { "location.state": state };
    if (severity) filter.severity = severity;
    if (diseaseCategory)
      filter["descriptionComponents.diseaseCategory"] = diseaseCategory;
    if (reportType) filter["descriptionComponents.reportType"] = reportType;

    const reports = await OUT.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = reports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(reports);
    }
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        state: state,
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting reports by state:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reports by state",
      error: error.message,
    });
  }
});

// Get reports by district with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/district/:district", async (req, res) => {
  try {
    const { district } = req.params;
    const {
      page = 1,
      limit = 10,
      severity,
      diseaseCategory,
      reportType,
      isActive = "true",
      skipVerification = "false",
    } = req.query;

    const filter = {
      "location.district": district,
      //   isActive: isActive === "true",
    };
    if (severity) filter.severity = severity;
    if (diseaseCategory)
      filter["descriptionComponents.diseaseCategory"] = diseaseCategory;
    if (reportType) filter["descriptionComponents.reportType"] = reportType;

    const reports = await OUT.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = reports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(reports);
    }
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        district: district,
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting reports by district:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reports by district",
      error: error.message,
    });
  }
});

// Get reports by pincode with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/pincode/:pincode", async (req, res) => {
  try {
    const { pincode } = req.params;
    const {
      page = 1,
      limit = 10,
      severity,
      diseaseCategory,
      reportType,
      isActive = "true",
      skipVerification = "false",
    } = req.query;

    const filter = {
      "location.pincode": pincode,
      //   isActive: isActive === "true",
    };
    if (severity) filter.severity = severity;
    if (diseaseCategory)
      filter["descriptionComponents.diseaseCategory"] = diseaseCategory;
    if (reportType) filter["descriptionComponents.reportType"] = reportType;

    const reports = await OUT.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = reports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(reports);
    }
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        pincode: pincode,
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting reports by pincode:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reports by pincode",
      error: error.message,
    });
  }
});

// Get reports by disease category with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/disease/:diseaseCategory", async (req, res) => {
  try {
    const { diseaseCategory } = req.params;
    const {
      page = 1,
      limit = 10,
      severity,
      reportType,
      isActive = "true",
      skipVerification = "false",
    } = req.query;

    const filter = {
      "descriptionComponents.diseaseCategory": diseaseCategory.toLowerCase(),
      //   isActive: isActive === "true",
    };
    if (severity) filter.severity = severity;
    if (reportType) filter["descriptionComponents.reportType"] = reportType;

    const reports = await OUT.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = reports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(reports);
    }
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        diseaseCategory: diseaseCategory,
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting reports by disease category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reports by disease category",
      error: error.message,
    });
  }
});

// Get reports by severity with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/severity/:severity", async (req, res) => {
  try {
    const { severity } = req.params;
    const {
      page = 1,
      limit = 10,
      diseaseCategory,
      reportType,
      isActive = "true",
      skipVerification = "false",
    } = req.query;

    const filter = { severity: severity };
    if (diseaseCategory)
      filter["descriptionComponents.diseaseCategory"] = diseaseCategory;
    if (reportType) filter["descriptionComponents.reportType"] = reportType;

    const reports = await OUT.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = reports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(reports);
    }
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        severity: severity,
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting reports by severity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reports by severity",
      error: error.message,
    });
  }
});

// Advanced search with multiple filters - UPDATED TO INCLUDE IMAGES
router.post("/search", async (req, res) => {
  try {
    const {
      location,
      severity,
      diseaseCategory,
      reportType,
      dateRange,
      suspectedCasesRange,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.body;

    // Build filter object
    let filter = {};

    if (location) {
      if (location.country) filter["location.country"] = location.country;
      if (location.state) filter["location.state"] = location.state;
      if (location.district) filter["location.district"] = location.district;
      if (location.pincode) filter["location.pincode"] = location.pincode;
    }

    if (severity)
      filter.severity = {
        $in: Array.isArray(severity) ? severity : [severity],
      };
    if (diseaseCategory)
      filter["descriptionComponents.diseaseCategory"] = {
        $in: Array.isArray(diseaseCategory)
          ? diseaseCategory
          : [diseaseCategory],
      };
    if (reportType)
      filter["descriptionComponents.reportType"] = {
        $in: Array.isArray(reportType) ? reportType : [reportType],
      };

    if (dateRange && dateRange.from && dateRange.to) {
      filter.createdAt = {
        $gte: new Date(dateRange.from),
        $lte: new Date(dateRange.to),
      };
    }

    if (suspectedCasesRange) {
      const casesFilter = {};
      if (suspectedCasesRange.min !== undefined)
        casesFilter.$gte = suspectedCasesRange.min;
      if (suspectedCasesRange.max !== undefined)
        casesFilter.$lte = suspectedCasesRange.max;
      if (Object.keys(casesFilter).length > 0) {
        filter["descriptionComponents.suspectedCases"] = casesFilter;
      }
    }

    const sortObject = {};
    sortObject[sortBy] = sortOrder === "asc" ? 1 : -1;

    const reports = await OUT.find(filter)
      .sort(sortObject)
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments(filter);

    // Format reports to include images
    const formattedReports = reports.map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        filters: {
          location,
          severity,
          diseaseCategory,
          reportType,
          dateRange,
          suspectedCasesRange,
        },
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error in advanced search:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform search",
      error: error.message,
    });
  }
});
// Get user's submitted reports (authenticated users only) with blockchain verification - UPDATED TO INCLUDE IMAGES
router.get("/my-reports", authMiddleware, async (req, res) => {
  try {
    const { email } = req.user;
    const { page = 1, limit = 10, skipVerification = "false" } = req.query;

    const userReports = await OUT.find({ "submittedBy.email": email })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((page - 1) * Number(limit))
      .lean();

    const totalReports = await OUT.countDocuments({
      "submittedBy.email": email,
    });

    // Verify blockchain integrity unless explicitly skipped
    let verifiedReports = userReports;
    if (skipVerification !== "true") {
      verifiedReports = await verifyAndUpdateRecords(userReports);
    }

    // Format reports to include images
    const formattedReports = (verifiedReports || []).map((r) => ({
      id: r._id,
      submittedBy: r.submittedBy,
      verifiedBy: r.verifiedBy || null,
      location: r.location,
      descriptionComponents: r.descriptionComponents,
      severity: r.severity,
      isActive: r.isActive,
      tampered: r.tampered,
      images: r.images || [], // Include images
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalReports: totalReports,
        currentPage: Number(page),
        totalPages: Math.ceil(totalReports / limit),
        verificationPerformed: skipVerification !== "true",
        reports: formattedReports,
      },
    });
  } catch (error) {
    console.error("Error getting user reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user reports",
      error: error.message,
    });
  }
});
// Get dashboard statistics
router.get("/stats", async (req, res) => {
  try {
    const totalReports = await OUT.countDocuments({ isActive: true });
    const verifiedReports = await OUT.countDocuments({
      isActive: true,
      verifiedBy: { $ne: null },
    });
    const pendingReports = await OUT.countDocuments({
      isActive: true,
      verifiedBy: null,
    });

    // Get reports by type
    const outbreakReports = await OUT.countDocuments({
      "descriptionComponents.reportType": "outbreak",
      isActive: true,
    });
    const healthSurveyReports = await OUT.countDocuments({
      "descriptionComponents.reportType": "health_survey",
      isActive: true,
    });
    const emergencyReports = await OUT.countDocuments({
      "descriptionComponents.reportType": "emergency",
      isActive: true,
    });

    // Get reports by severity
    const criticalReports = await OUT.countDocuments({
      severity: "critical",
      isActive: true,
    });
    const highSeverityReports = await OUT.countDocuments({
      severity: "high",
      isActive: true,
    });
    const moderateReports = await OUT.countDocuments({
      severity: "moderate",
      isActive: true,
    });
    const lowSeverityReports = await OUT.countDocuments({
      severity: "low",
      isActive: true,
    });

    // Get reports by disease category
    const diseaseStats = await OUT.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$descriptionComponents.diseaseCategory",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get recent reports (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentReports = await OUT.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalReports,
          verifiedReports,
          pendingReports,
          recentReports,
        },
        reportsByType: {
          outbreak: outbreakReports,
          health_survey: healthSurveyReports,
          emergency: emergencyReports,
        },
        reportsBySeverity: {
          critical: criticalReports,
          high: highSeverityReports,
          moderate: moderateReports,
          low: lowSeverityReports,
        },
        reportsByDiseaseCategory: diseaseStats,
      },
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get statistics",
      error: error.message,
    });
  }
});

// Toggle report active status (soft delete)
router.patch(
  "/toggle-status/:reportId",
  authMiddleware,
  restrictRole(["ngo", "health_worker"]),
  async (req, res) => {
    try {
      const { reportId } = req.params;
      // const { isActive } = req.body;

      const updatedReport = await OUT.findByIdAndUpdate(
        reportId,
        [
          {
            $set: { isActive: { $not: ["$isActive"] } }, // must be an array: ["$isActive"]
          },
        ],
        { new: true }
      );

      console.log("Toggled state:", updatedReport.isActive);

      if (!updatedReport) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      res.status(200).json({
        success: true,
        message: `Report ${
          updatedReport.isActive ? "activated" : "deactivated"
        } successfully`,
        data: updatedReport,
      });
    } catch (error) {
      console.error("Error toggling report status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle report status",
        error: error.message,
      });
    }
  }
);

module.exports = router;
