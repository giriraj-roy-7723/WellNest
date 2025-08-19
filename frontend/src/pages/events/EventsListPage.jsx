import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  User,
  Heart,
  Droplets,
  Plus,
  Truck,
  Apple,
  ArrowLeft,
} from "lucide-react";

import "../../styles/event-styles/EventListPage.css";
import Navbar from "../../components/Navbar.jsx";
import { blockchainApi } from "../../utils/api.js"; // use axios instance

const EventsListPage = () => {
  const navigate = useNavigate();
  const { eventType } = useParams();
  const location = useLocation();
  const { eventTypeName, userRole, userId } = location.state || {};

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participantsCounts, setParticipantsCounts] = useState({});

  const currentUserRole =
    userRole || localStorage.getItem("userRole") || "patient";
  const currentUserId = userId || localStorage.getItem("userId") || "";

  const eventIcons = {
    "health-checkup": <Heart className="icon blue" />,
    vaccination: <Plus className="icon green" />,
    "blood-donation": <Droplets className="icon red" />,
    "mobile-health": <Truck className="icon purple" />,
    nutrition: <Apple className="icon orange" />,
    other: <Calendar className="icon gray" />,
  };

  const eventTypeNames = {
    "health-checkup": "Free Health CheckUp",
    vaccination: "Vaccination Drive",
    "blood-donation": "Blood Donation Camp",
    "mobile-health": "Mobile Health Camp",
    nutrition: "Nutrition & Diet Camps",
    other: "Other",
  };

  const displayName = eventTypeName || eventTypeNames[eventType] || "Events";

  useEffect(() => {
    fetchEvents();
  }, [eventType]);

  const fetchEvents = async () => {
    try {
      setLoading(true);

      // ✅ get all events
      const { data } = await blockchainApi.get("/organise/all");

      if (data.success) {
        let fetched = data.orgs || [];

        // filter by eventType
        if (eventType) {
          fetched = fetched.filter((e) => {
            if (eventType === "health-checkup")
              return e.eventType === "Free Health CheckUp";
            if (eventType === "vaccination")
              return e.eventType === "Vaccination Drive";
            if (eventType === "blood-donation")
              return e.eventType === "Blood Donation Camp";
            if (eventType === "mobile-health")
              return e.eventType === "Mobile Health Camp";
            if (eventType === "nutrition")
              return e.eventType === "Nutrition & Diet Camps";
            if (eventType === "other") return e.eventType === "Other";
            return true;
          });
        }

        setEvents(fetched);

        // ✅ fetch participants counts per event
        const counts = await Promise.all(
          fetched.map(async (e) => {
            try {
              const { data: d } = await blockchainApi.get(
                `/part/participants/${e._id}`
              );
              return [e._id, d.success ? (d.participants || []).length : 0];
            } catch (err) {
              alert("Error fetching participants for event " + e._id);
              return [e._id, 0];
            }
          })
        );
        setParticipantsCounts(Object.fromEntries(counts));
      } else {
        alert(data.error || "No events found");
      }
    } catch (error) {
      alert("Error fetching events: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (event) => {
    navigate(`/events/register/${event._id}`, {
      state: {
        eventDetails: {
          eventTypeName: displayName,
          eventType,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          organizerName: event.name,
          locationURL: event.locationURL,
        },
      },
    });
  };

  const handleViewParticipants = (eventId) => {
    navigate(`/events/participants/${eventId}`, {
      state: { eventType, eventTypeName: displayName },
    });
  };

  const handleDelete = async (event) => {
    const eventId = event._id; // Ensure we use the MongoDB _id
    if (!eventId) {
      alert("Invalid event ID. Cannot delete.");
      return;
    }

    // Confirm with user
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      console.log("Deleting event:", eventId);
      const { data } = await blockchainApi.patch(`/organise/delete/${eventId}`);
      console.log("Delete response:", data);

      if (data.success) {
        alert("Event deleted successfully!");
        await fetchEvents(); // Refresh events list
      } else {
        alert(data.error || "Delete failed");
      }
    } catch (err) {
      if (err.response) {
        // Request reached backend but returned an error
        if (err.response.status === 404) {
          alert("Event not found or already deleted.");
        } else {
          alert(
            `Delete failed with status ${err.response.status}: ${
              err.response.data?.error || err.message
            }`
          );
        }
      } else if (err.request) {
        // Request was sent but no response
        alert("No response from server. Please check your network or backend.");
      } else {
        // Other errors
        alert("Delete error: " + err.message);
      }
      console.error("Delete error details:", err);
    }
  };

  const handleBack = () => {
    navigate("/events");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/signin");
  };

  return (
    <div className="page">
      <Navbar onLogout={handleLogout} />
      <div className="page-container">
        <div className="header">
          <button onClick={handleBack} className="back-btn">
            <ArrowLeft className="icon small" />
            Back to Events
          </button>

          <div className="title-row">
            {eventIcons[eventType] || <Calendar className="icon gray" />}
            <h1 className="page-title">{displayName}</h1>
          </div>
          <p className="subtitle">
            {events.length} {events.length === 1 ? "event" : "events"} available
          </p>
        </div>

        {events.length === 0 ? (
          <div className="no-events">
            <Calendar className="icon large gray" />
            <h3>No events found</h3>
            <p>
              There are no {displayName.toLowerCase()} events scheduled at the
              moment.
            </p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event) => {
              const now = new Date();
              const eventStart = new Date(`${event.date}T${event.startTime}`);
              const eventEnd = new Date(`${event.date}T${event.endTime}`);

              let actionButton;
              if (now < eventStart) {
                actionButton = (
                  <button
                    onClick={() => handleRegister(event)}
                    className="btn btn-primary"
                  >
                    <Users className="icon small" />
                    Register
                  </button>
                );
              } else if (now >= eventStart && now <= eventEnd) {
                actionButton = (
                  <button className="btn btn-outline orange" disabled>
                    <Clock className="icon small" />
                    Event Started
                  </button>
                );
              } else {
                actionButton = (
                  <button className="btn btn-outline gray" disabled>
                    <Clock className="icon small" />
                    Event Ended
                  </button>
                );
              }

              return (
                <div key={event._id} className="event-card">
                  <div className="event-header">
                    <div className="event-title">
                      {eventIcons[eventType] || (
                        <Calendar className="icon gray" />
                      )}
                      <h3>{displayName}</h3>
                    </div>
                    {eventType === "blood-donation" && (
                      <div className="rewards-badge">💰 Rewards</div>
                    )}
                  </div>

                  <div className="organizer">
                    <User className="icon small gray" />
                    <span>
                      Organized by <b>{event.name}</b>
                    </span>
                  </div>

                  <div className="details">
                    <div>
                      <Calendar className="icon small gray" />
                      {formatDate(event.date)}
                    </div>
                    <div>
                      <Clock className="icon small gray" />
                      {formatTime(event.startTime)} -{" "}
                      {formatTime(event.endTime)}
                    </div>
                    <div>
                      <MapPin className="icon small gray" />
                      <span>{event.location}</span>
                    </div>
                  </div>

                  {event.description && (
                    <p className="description">{event.description}</p>
                  )}

                  <div className="actions">
                    {event.locationURL && (
                      <a
                        href={event.locationURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline blue"
                      >
                        <MapPin className="icon small" />
                        View Location
                      </a>
                    )}

                    {event.shortId !== currentUserId && actionButton}

                    {/* {(event.shortId === currentUserId || */}
                    {/* ["ngo", "health_worker"].includes(currentUserRole)) && ( */}
                    <button
                      onClick={() => handleViewParticipants(event._id)}
                      className="btn btn-outline green"
                    >
                      <Users className="icon small" />
                      View Participants
                    </button>
                    {/* )} */}

                    {["ngo", "health_worker"].includes(currentUserRole) && (
                      <button
                        onClick={() =>
                          navigate(`/events/organize/${eventType}`, {
                            state: { eventTypeName: displayName },
                          })
                        }
                        className="btn btn-outline purple"
                      >
                        <Plus className="icon small" />
                        Organize Similar
                      </button>
                    )}

                    {["ngo", "health_worker"].includes(currentUserRole) &&
                      event.shortId === currentUserId && (
                        <button
                          onClick={() => handleDelete(event)}
                          className="btn btn-outline red"
                        >
                          Delete Event
                        </button>
                      )}
                  </div>

                  <div className="participants-meta">
                    <Users className="icon small gray" />
                    <span>
                      {participantsCounts[event._id] || 0} participant
                      {(participantsCounts[event._id] || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsListPage;
