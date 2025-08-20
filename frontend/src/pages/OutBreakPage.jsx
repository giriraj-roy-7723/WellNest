import React, { useState, useEffect } from "react";
import {
  Plus,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import api, { blockchainApi } from "../utils/api.js";
import { getToken, removeToken } from "../utils/auth.js";
import "../styles/OutbreakDashboard.css";

// API service using axios
const outbreakApi = {
  getAllReports: async (params = {}) => {
    try {
      const response = await blockchainApi.get("/outbreak/country/india", {
        params,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching reports:", error);
      throw error;
    }
  },

  submitReport: async (formData) => {
    try {
      const response = await blockchainApi.post(
        "/outbreak/submit-public",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error submitting report:", error);
      throw error;
    }
  },

  verifyReport: async (reportId) => {
    try {
      const response = await blockchainApi.patch(
        `/outbreak/verify/${reportId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error verifying report:", error);
      throw error;
    }
  },

  toggleReportStatus: async (reportId) => {
    try {
      const response = await blockchainApi.patch(
        `/outbreak/toggle-status/${reportId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error toggling report status:", error);
      throw error;
    }
  },
};

// User API for getting current user info
const userApi = {
  getCurrentUser: async () => {
    try {
      const response = await api.get("/auth/me");
      return response.data;
    } catch (error) {
      console.error("Error fetching user info:", error);
      throw error;
    }
  },
};

const DISEASE_CATEGORIES = [
  "respiratory",
  "gastrointestinal",
  "vector_borne",
  "waterborne",
  "foodborne",
  "skin",
  "neurological",
  "other",
];

const REPORT_TYPES = ["outbreak", "health_survey", "emergency"];
const SEVERITY_LEVELS = ["low", "moderate", "high", "critical"];

const OutbreakDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState("public");

  // Form state
  const [formData, setFormData] = useState({
    submittedBy: { name: "", email: "", phoneNumber: "" },
    location: {
      country: "India",
      state: "",
      district: "",
      pincode: "",
      googleMapsLink: "",
    },
    descriptionComponents: {
      reportType: "outbreak",
      diseaseCategory: "",
      suspectedCases: 0,
      basicInfo: "",
      symptoms: "",
      additionalNotes: "",
    },
    severity: "moderate",
  });
  const [selectedImages, setSelectedImages] = useState([]);

  // Check if user is authenticated and get user info
  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchCurrentUser();
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const fetchCurrentUser = async () => {
    try {
      const userData = await userApi.getCurrentUser();
      setCurrentUser(userData.user);

      // Set user role based on the user's role from backend
      if (
        userData.user?.role === "ngo" ||
        userData.user?.role === "health_worker"
      ) {
        setUserRole(userData.user.role);
      } else {
        setUserRole("public");
      }

      // Pre-fill form with user data if available
      setFormData((prev) => ({
        ...prev,
        submittedBy: {
          name: userData.user?.name || "",
          email: userData.user?.email || "",
          phoneNumber: userData.user?.phoneNumber || "",
        },
      }));
    } catch (error) {
      console.error("Error fetching user data:", error);
      // If error fetching user, treat as public user
      setUserRole("public");
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const result = await outbreakApi.getAllReports(filters);
      setReports(result.data?.reports || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
      // Show user-friendly error message
      if (error.response?.status === 401) {
        alert("Session expired. Please log in again.");
        handleLogout();
      } else {
        alert("Error fetching reports. Please try again.");
      }
    }
    setLoading(false);
  };

  const handleSubmitReport = async () => {
    // Validate required fields
    if (!formData.submittedBy.name || !formData.submittedBy.email) {
      alert("Please fill in your name and email.");
      return;
    }

    if (!formData.location.state || !formData.location.district) {
      alert("Please fill in state and district information.");
      return;
    }

    if (!formData.descriptionComponents.diseaseCategory) {
      alert("Please select a disease category.");
      return;
    }

    setLoading(true);

    const formDataToSend = new FormData();

    // Add form fields
    Object.keys(formData).forEach((key) => {
      if (typeof formData[key] === "object") {
        formDataToSend.append(key, JSON.stringify(formData[key]));
      } else {
        formDataToSend.append(key, formData[key]);
      }
    });

    // Add images
    selectedImages.forEach((image) => {
      formDataToSend.append("images", image);
    });

    try {
      const result = await outbreakApi.submitReport(formDataToSend);
      if (result.success) {
        alert("Report submitted successfully!");
        setShowForm(false);
        resetForm();
        fetchReports();
      } else {
        alert(result.message || "Error submitting report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      if (error.response?.status === 401) {
        alert("Please log in to submit reports.");
        handleLogout();
      } else {
        alert(error.response?.data?.message || "Error submitting report");
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      submittedBy: {
        name: currentUser?.name || "",
        email: currentUser?.email || "",
        phoneNumber: currentUser?.phoneNumber || "",
      },
      location: {
        country: "India",
        state: "",
        district: "",
        pincode: "",
        googleMapsLink: "",
      },
      descriptionComponents: {
        reportType: "outbreak",
        diseaseCategory: "",
        suspectedCases: 0,
        basicInfo: "",
        symptoms: "",
        additionalNotes: "",
      },
      severity: "moderate",
    });
    setSelectedImages([]);
  };

  const handleVerifyReport = async (reportId) => {
    if (!getToken()) {
      alert("Please login to verify reports");
      return;
    }

    try {
      const result = await outbreakApi.verifyReport(reportId);
      if (result.success) {
        alert("Report verified successfully!");
        fetchReports();
      } else {
        alert(result.message || "Error verifying report");
      }
    } catch (error) {
      console.error("Error verifying report:", error);
      if (error.response?.status === 401) {
        alert("Please login to verify reports");
        handleLogout();
      } else if (error.response?.status === 403) {
        alert("You don't have permission to verify reports");
      } else {
        alert(error.response?.data?.message || "Error verifying report");
      }
    }
  };

  const handleToggleStatus = async (reportId) => {
    if (!getToken()) {
      alert("Please login to toggle report status");
      return;
    }

    try {
      const result = await outbreakApi.toggleReportStatus(reportId);
      if (result.success) {
        alert(result.message || "Report status updated successfully!");
        fetchReports();
      } else {
        alert(result.message || "Error updating report status");
      }
    } catch (error) {
      console.error("Error toggling report status:", error);
      if (error.response?.status === 401) {
        alert("Please login to manage reports");
        handleLogout();
      } else if (error.response?.status === 403) {
        alert("You don't have permission to manage reports");
      } else {
        alert(error.response?.data?.message || "Error updating report status");
      }
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: "severity-low",
      moderate: "severity-moderate",
      high: "severity-high",
      critical: "severity-critical",
    };
    return colors[severity] || "severity-default";
  };

  const isRecentReport = (createdAt) => {
    const reportDate = new Date(createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return reportDate >= sevenDaysAgo;
  };

  const filteredReports = reports.filter((report) => {
    if (filters.includeInactive) return true;
    return report.isActive && isRecentReport(report.createdAt);
  });

  const handleLogout = () => {
    removeToken();
    navigate("/signin");
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      public: "Public User",
      ngo: "NGO Worker",
      health_worker: "Health Worker",
    };
    return roleNames[role] || "Public User";
  };

  return (
    <div className="page">
      <Navbar onLogout={handleLogout} />
      <div className="dashboard-container">
        <div className="container">
          {/* Header */}
          <div className="header-section">
            <div className="header-content">
              <div>
                <h1 className="main-title">Outbreak Reporting System</h1>
                <p className="main-subtitle">
                  Monitor and report disease outbreaks in your community
                </p>
              </div>
              <div className="header-controls">
                {/* User Role Display */}
                <div className="user-info">
                  <span className="role-display">
                    Role: {getRoleDisplayName(userRole)}
                  </span>
                  {currentUser && (
                    <span className="user-name">
                      Welcome, {currentUser.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="nav-tabs">
              <button
                onClick={() => setActiveTab("reports")}
                className={`tab-button ${
                  activeTab === "reports" ? "active" : ""
                }`}
              >
                <Eye className="tab-icon" />
                View Reports
              </button>
              <button
                onClick={() => {
                  setActiveTab("submit");
                  setShowForm(true);
                }}
                className={`tab-button ${
                  activeTab === "submit" ? "active" : ""
                }`}
              >
                <Plus className="tab-icon" />
                Submit Report
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          {activeTab === "reports" && (
            <div className="filters-section">
              <div className="filters-grid">
                <input
                  type="text"
                  placeholder="Search by state..."
                  className="filter-input"
                  onChange={(e) =>
                    setFilters({ ...filters, state: e.target.value })
                  }
                />
                <select
                  className="filter-select"
                  onChange={(e) =>
                    setFilters({ ...filters, severity: e.target.value })
                  }
                >
                  <option value="">All Severities</option>
                  {SEVERITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  onChange={(e) =>
                    setFilters({ ...filters, diseaseCategory: e.target.value })
                  }
                >
                  <option value="">All Categories</option>
                  {DISEASE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category.replace("_", " ").charAt(0).toUpperCase() +
                        category.replace("_", " ").slice(1)}
                    </option>
                  ))}
                </select>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox"
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        includeInactive: e.target.checked,
                      })
                    }
                  />
                  Include Inactive
                </label>
              </div>
            </div>
          )}

          {/* Reports List */}
          {activeTab === "reports" && (
            <div className="reports-list">
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p className="loading-text">Loading reports...</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="no-reports">
                  <p>No reports found matching your criteria.</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-header">
                      <div className="report-info">
                        <div className="report-badges">
                          <span
                            className={`severity-badge ${getSeverityColor(
                              report.severity
                            )}`}
                          >
                            {report.severity.toUpperCase()}
                          </span>
                          {!report.isActive && (
                            <span className="inactive-badge">INACTIVE</span>
                          )}
                          <span className="type-badge">
                            {report.descriptionComponents.reportType
                              .replace("_", " ")
                              .toUpperCase()}
                          </span>
                        </div>
                        <h3 className="report-title">
                          {report.descriptionComponents.diseaseCategory.replace(
                            "_",
                            " "
                          )}{" "}
                          Outbreak
                        </h3>
                        <div className="report-location">
                          <MapPin className="location-icon" />
                          {report.location.district}, {report.location.state},{" "}
                          {report.location.country}
                        </div>
                        <div className="report-date">
                          <Calendar className="date-icon" />
                          {new Date(report.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Action buttons for authorized users */}
                      {(userRole === "ngo" || userRole === "health_worker") &&
                        getToken() && (
                          <div className="action-buttons">
                            {!report.verifiedBy && (
                              <button
                                onClick={() => handleVerifyReport(report.id)}
                                className="verify-btn"
                              >
                                <CheckCircle className="btn-icon" />
                                Verify
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleStatus(report.id)}
                              className={`toggle-btn ${
                                report.isActive ? "deactivate" : "activate"
                              }`}
                            >
                              {report.isActive ? (
                                <XCircle className="btn-icon" />
                              ) : (
                                <CheckCircle className="btn-icon" />
                              )}
                              {report.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        )}
                    </div>

                    <div className="report-details">
                      <div>
                        <p className="detail-label">Suspected Cases</p>
                        <p className="detail-value">
                          {report.descriptionComponents.suspectedCases}
                        </p>
                      </div>
                      <div>
                        <p className="detail-label">Reported By</p>
                        <p className="detail-value">
                          {report.submittedBy.name}
                        </p>
                      </div>
                    </div>

                    {report.descriptionComponents.symptoms && (
                      <div className="symptoms-section">
                        <p className="section-label">Symptoms</p>
                        <p className="section-content">
                          {report.descriptionComponents.symptoms}
                        </p>
                      </div>
                    )}

                    {report.images && report.images.length > 0 && (
                      <div className="images-section">
                        <p className="section-label">Evidence Images</p>
                        <div className="images-grid">
                          {report.images.map((image, idx) => (
                            <img
                              key={idx}
                              src={`http://localhost:8000${image}`}
                              alt={`Evidence ${idx + 1}`}
                              className="evidence-image"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {report.verifiedBy && (
                      <div className="verified-section">
                        <CheckCircle className="verified-icon" />
                        <span className="verified-text">Verified</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Submit Report Form */}
          {showForm && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title">Submit Outbreak Report</h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="close-btn"
                  >
                    <X className="close-icon" />
                  </button>
                </div>

                <div className="form-content">
                  {/* Personal Information */}
                  <div className="form-section">
                    <h3 className="section-title">Personal Information</h3>
                    <div className="form-grid-3">
                      <input
                        type="text"
                        placeholder="Full Name"
                        required
                        className="form-input"
                        value={formData.submittedBy.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            submittedBy: {
                              ...formData.submittedBy,
                              name: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        required
                        className="form-input"
                        value={formData.submittedBy.email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            submittedBy: {
                              ...formData.submittedBy,
                              email: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        className="form-input"
                        value={formData.submittedBy.phoneNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            submittedBy: {
                              ...formData.submittedBy,
                              phoneNumber: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Location Information */}
                  <div className="form-section">
                    <h3 className="section-title">Location Information</h3>
                    <div className="form-grid-4">
                      <input
                        type="text"
                        placeholder="State"
                        required
                        className="form-input"
                        value={formData.location.state}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: {
                              ...formData.location,
                              state: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        type="text"
                        placeholder="District"
                        required
                        className="form-input"
                        value={formData.location.district}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: {
                              ...formData.location,
                              district: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        type="text"
                        placeholder="Pincode"
                        className="form-input"
                        value={formData.location.pincode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: {
                              ...formData.location,
                              pincode: e.target.value,
                            },
                          })
                        }
                      />
                      <input
                        type="url"
                        placeholder="Google Maps Link"
                        required
                        className="form-input"
                        value={formData.location.googleMapsLink}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: {
                              ...formData.location,
                              googleMapsLink: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Report Details */}
                  <div className="form-section">
                    <h3 className="section-title">Report Details</h3>
                    <div className="form-grid-4">
                      <select
                        required
                        className="form-select"
                        value={formData.descriptionComponents.reportType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            descriptionComponents: {
                              ...formData.descriptionComponents,
                              reportType: e.target.value,
                            },
                          })
                        }
                      >
                        {REPORT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.replace("_", " ").charAt(0).toUpperCase() +
                              type.replace("_", " ").slice(1)}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        className="form-select"
                        value={formData.descriptionComponents.diseaseCategory}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            descriptionComponents: {
                              ...formData.descriptionComponents,
                              diseaseCategory: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Select Disease Category</option>
                        {DISEASE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category
                              .replace("_", " ")
                              .charAt(0)
                              .toUpperCase() +
                              category.replace("_", " ").slice(1)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Suspected Cases"
                        min="0"
                        required
                        className="form-input"
                        value={formData.descriptionComponents.suspectedCases}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            descriptionComponents: {
                              ...formData.descriptionComponents,
                              suspectedCases: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                      />
                      <select
                        required
                        className="form-select"
                        value={formData.severity}
                        onChange={(e) =>
                          setFormData({ ...formData, severity: e.target.value })
                        }
                      >
                        {SEVERITY_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-textareas">
                      <textarea
                        placeholder="Basic Information"
                        className="form-textarea"
                        rows="3"
                        value={formData.descriptionComponents.basicInfo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            descriptionComponents: {
                              ...formData.descriptionComponents,
                              basicInfo: e.target.value,
                            },
                          })
                        }
                      />
                      <textarea
                        placeholder="Symptoms"
                        className="form-textarea"
                        rows="3"
                        value={formData.descriptionComponents.symptoms}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            descriptionComponents: {
                              ...formData.descriptionComponents,
                              symptoms: e.target.value,
                            },
                          })
                        }
                      />
                      <textarea
                        placeholder="Additional Notes"
                        className="form-textarea"
                        rows="3"
                        value={formData.descriptionComponents.additionalNotes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            descriptionComponents: {
                              ...formData.descriptionComponents,
                              additionalNotes: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div className="form-section">
                    <h3 className="section-title">
                      Evidence Images (Optional)
                    </h3>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) =>
                        setSelectedImages(Array.from(e.target.files))
                      }
                      className="file-input"
                    />
                    {selectedImages.length > 0 && (
                      <p className="file-info">
                        {selectedImages.length} image(s) selected
                      </p>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReport}
                      disabled={loading}
                      className="submit-btn"
                    >
                      {loading ? "Submitting..." : "Submit Report"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutbreakDashboard;
