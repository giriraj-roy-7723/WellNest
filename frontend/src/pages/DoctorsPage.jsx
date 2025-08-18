import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";
import Navbar from "../components/Navbar.jsx";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/signin");
      return;
    }
    fetchDoctors();
  }, [navigate]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      console.log("Fetching doctors...");
      const response = await api.get("/doctors");
      console.log("Doctors response:", response);
      console.log("Response data:", response.data);
      console.log("Response data.data:", response.data.data);
      console.log("Response data.data.items:", response.data.data?.items);
      
      if (response.data && response.data.data && response.data.data.items) {
        setDoctors(response.data.data.items);
      } else if (response.data && response.data.data) {
        setDoctors(response.data.data);
      } else {
        setDoctors(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching doctors:", err);
      if (err.response) {
        console.error("Error response:", err.response);
        setError(`Failed to fetch doctors: ${err.response.status} - ${err.response.data?.message || 'Unknown error'}`);
      } else if (err.request) {
        setError("Failed to fetch doctors: No response from server");
      } else {
        setError(`Failed to fetch doctors: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/signin");
  };

  // Helper function to format availability
  const formatAvailability = (availability) => {
    if (typeof availability === 'string') {
      return availability;
    }
    if (typeof availability === 'object' && availability !== null) {
      return Object.keys(availability).join(', ');
    }
    return "Not specified";
  };

  // Handle viewing doctor profile
  const handleViewProfile = (doctor) => {
    setSelectedDoctor(doctor);
    setShowProfileModal(true);
  };

  // Close profile modal
  const closeProfileModal = () => {
    setShowProfileModal(false);
    setSelectedDoctor(null);
  };

  if (loading) {
    return (
      <div className="page">
        <Navbar onLogout={handleLogout} />
        <div className="page-content">
          <div className="section-header">
            <h1 className="section-title">Doctors</h1>
            <p className="section-subtitle">Find and connect with healthcare professionals</p>
          </div>
          <div className="section-content">
            <div className="loading-spinner"></div>
            <p>Loading doctors...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Navbar onLogout={handleLogout} />
        <div className="page-content">
          <div className="section-header">
            <h1 className="section-title">Doctors</h1>
            <p className="section-subtitle">Find and connect with healthcare professionals</p>
          </div>
          <div className="section-content">
            <div className="error-message">{error}</div>
            <button className="btn btn-primary" onClick={fetchDoctors}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar onLogout={handleLogout} />
      <div className="page-content">
        <div className="section-header">
          <h1 className="section-title">Doctors</h1>
          <p className="section-subtitle">Find and connect with healthcare professionals</p>
        </div>

        <div className="section-content">
          {doctors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍⚕️</div>
              <h3>No Doctors Available</h3>
              <p>Check back later for available doctors.</p>
            </div>
          ) : (
            <div className="grid-3">
              {doctors.map((doctor, index) => (
                <div key={doctor._id || index} className="card doctor-card">
                  <div className="card-header">
                    <div className="card-icon">👨‍⚕️</div>
                    <h3 className="card-title">
                      {doctor.user ? `${doctor.user.firstName} ${doctor.user.lastName}` : doctor.name || "Dr. Name"}
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="doctor-info">
                      <div className="info-item">
                        <strong>Specialization:</strong>
                        <span>{doctor.specialisation || doctor.specialization || "General Medicine"}</span>
                      </div>
                      {doctor.affiliation && (
                        <div className="info-item">
                          <strong>Affiliation:</strong>
                          <span>{doctor.affiliation}</span>
                        </div>
                      )}
                      {doctor.licenseNumber && (
                        <div className="info-item">
                          <strong>License Number:</strong>
                          <span>{doctor.licenseNumber}</span>
                        </div>
                      )}
                      {doctor.gender && (
                        <div className="info-item">
                          <strong>Gender:</strong>
                          <span>{doctor.gender}</span>
                        </div>
                      )}
                      {doctor.fee && (
                        <div className="info-item">
                          <strong>Consultation Fee:</strong>
                          <span>₹{doctor.fee}</span>
                        </div>
                      )}
                      {doctor.availability && (
                        <div className="info-item">
                          <strong>Availability:</strong>
                          <span>{formatAvailability(doctor.availability)}</span>
                        </div>
                      )}
                    </div>
                    <div className="doctor-actions">
                      <button className="btn btn-primary btn-small">
                        Book Appointment
                      </button>
                      <button 
                        className="btn btn-outline btn-small"
                        onClick={() => handleViewProfile(doctor)}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Doctor Profile Modal */}
      {showProfileModal && selectedDoctor && (
        <div className="modal-overlay" onClick={closeProfileModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Doctor Profile</h3>
              <button className="modal-close" onClick={closeProfileModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="doctor-profile">
                <div className="profile-header">
                  <div className="profile-avatar">👨‍⚕️</div>
                  <div className="profile-name">
                    <h2>{selectedDoctor.user ? `${selectedDoctor.user.firstName} ${selectedDoctor.user.lastName}` : selectedDoctor.name || "Dr. Name"}</h2>
                    <p className="profile-title">{selectedDoctor.specialisation || selectedDoctor.specialization || "General Medicine"}</p>
                  </div>
                </div>
                
                <div className="profile-details">
                  <div className="detail-section">
                    <h4>Professional Information</h4>
                    <div className="detail-grid">
                      {selectedDoctor.licenseNumber && (
                        <div className="detail-item">
                          <strong>License Number:</strong>
                          <span>{selectedDoctor.licenseNumber}</span>
                        </div>
                      )}
                      {selectedDoctor.affiliation && (
                        <div className="detail-item">
                          <strong>Affiliation:</strong>
                          <span>{selectedDoctor.affiliation}</span>
                        </div>
                      )}
                      {selectedDoctor.gender && (
                        <div className="detail-item">
                          <strong>Gender:</strong>
                          <span>{selectedDoctor.gender}</span>
                        </div>
                      )}
                      {selectedDoctor.fee && (
                        <div className="detail-item">
                          <strong>Consultation Fee:</strong>
                          <span>₹{selectedDoctor.fee}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedDoctor.availability && (
                    <div className="detail-section">
                      <h4>Availability</h4>
                      <div className="availability-display">
                        {typeof selectedDoctor.availability === 'object' ? (
                          <div className="availability-grid">
                            {Object.entries(selectedDoctor.availability).map(([day, available]) => (
                              <div key={day} className={`availability-day ${available ? 'available' : 'unavailable'}`}>
                                <span className="day-name">{day.toUpperCase()}</span>
                                <span className="day-status">{available ? '✓' : '✗'}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p>{selectedDoctor.availability}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedDoctor.about && (
                    <div className="detail-section">
                      <h4>About</h4>
                      <p>{selectedDoctor.about}</p>
                    </div>
                  )}

                  {selectedDoctor.experience && (
                    <div className="detail-section">
                      <h4>Experience</h4>
                      <p>{selectedDoctor.experience}</p>
                    </div>
                  )}
                </div>

                <div className="profile-actions">
                  <button className="btn btn-primary">
                    Book Appointment
                  </button>
                  <button className="btn btn-outline" onClick={closeProfileModal}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
