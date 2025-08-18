import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Heart,
  Droplets,
  Plus,
  Truck,
  Apple,
  Users,
  Award,
  TrendingUp,
} from "lucide-react";
import "../../styles/EventsMainPage.css";
import Navbar from "../../components/Navbar.jsx";

const EventsMainPage = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState("patient");
  const [userId, setUserId] = useState("");
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalParticipants: 0,
    upcomingEvents: 0,
  });

  const eventTypes = [
    {
      id: "health-checkup",
      name: "Free Health CheckUp",
      icon: <Heart className="icon" />,
      color: "blue",
      description: "Comprehensive health screening and checkup services",
    },
    {
      id: "vaccination",
      name: "Vaccination Drive",
      icon: <Plus className="icon" />,
      color: "green",
      description: "Immunization programs for various diseases",
    },
    {
      id: "blood-donation",
      name: "Blood Donation Camp",
      icon: <Droplets className="icon" />,
      color: "red",
      description: "Blood donation drives with crypto rewards",
      hasRewards: true,
    },
    {
      id: "mobile-health",
      name: "Mobile Health Camp",
      icon: <Truck className="icon" />,
      color: "purple",
      description: "Healthcare services in remote and underserved areas",
    },
    {
      id: "nutrition",
      name: "Nutrition & Diet Camps",
      icon: <Apple className="icon" />,
      color: "orange",
      description: "Nutritional counseling and dietary guidance",
    },
    {
      id: "other",
      name: "Other Events",
      icon: <Calendar className="icon" />,
      color: "gray",
      description: "Miscellaneous healthcare events and programs",
    },
  ];

  const canOrganize = ["ngo", "health_worker"].includes(userRole);

  useEffect(() => {
    fetchUserData();
    fetchStats();
  }, []);

  const fetchUserData = () => {
    const role = localStorage.getItem("userRole") || "patient";
    const id = localStorage.getItem("userId") || "";
    setUserRole(role);
    setUserId(id);
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("http://localhost:8000/organise/all", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        const events = data.orgs || [];
        const now = new Date();
        const upcoming = events.filter((e) => new Date(e.date) > now).length;

        // Aggregate total participants across all events
        const participantCounts = await Promise.all(
          events.map(async (e) => {
            try {
              const r = await fetch(
                `http://localhost:8000/part/participants/${e._id}`,
                {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                  },
                }
              );
              const d = await r.json();
              return d.success ? (d.participants || []).length : 0;
            } catch (_) {
              return 0;
            }
          })
        );
        const totalParticipants = participantCounts.reduce(
          (sum, c) => sum + c,
          0
        );

        setStats({
          totalEvents: events.length,
          totalParticipants,
          upcomingEvents: upcoming,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleEventSelect = (eventType, eventName) => {
    // Frontend route, this page should fetch event list from /organise/all
    navigate(`/events/${eventType}`, {
      state: { eventTypeName: eventName, userRole, userId },
    });
  };

  const handleOrganizeEvent = (eventType, eventName) => {
    // Organize form -> will call PATCH /organise/set in that page
    navigate(`/events/organize/${eventType}`, {
      state: { eventTypeName: eventName },
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/signin");
  };

  return (
    <div className="page">
      <Navbar onLogout={handleLogout} />
      <div className="events-page">
        {/* Header */}
        <div className="header">
          <div className="header-inner">
            <div>
              <h1 className="page-title">Healthcare Events</h1>
              <p className="page-subtitle">
                Discover and participate in healthcare events in your community
              </p>
            </div>
            {canOrganize && (
              <div className="organize-badge">✨ You can organize events</div>
            )}
          </div>
        </div>

        <div className="content">
          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <Calendar className="stat-icon blue" />
              <div>
                <h3 className="stat-title">Total Events</h3>
                <p className="stat-value blue">{stats.totalEvents}</p>
              </div>
            </div>
            <div className="stat-card">
              <Users className="stat-icon green" />
              <div>
                <h3 className="stat-title">Participants</h3>
                <p className="stat-value green">{stats.totalParticipants}</p>
              </div>
            </div>
            <div className="stat-card">
              <TrendingUp className="stat-icon purple" />
              <div>
                <h3 className="stat-title">Upcoming</h3>
                <p className="stat-value purple">{stats.upcomingEvents}</p>
              </div>
            </div>
          </div>

          {/* Event Types */}
          <div className="events-section">
            <h2 className="section-title">Browse Events by Category</h2>
            <div className="events-grid">
              {eventTypes.map((event) => (
                <div
                  key={event.id}
                  className={`event-card ${event.color}`}
                  onClick={() => handleEventSelect(event.id, event.name)}
                >
                  <div className="event-card-inner">
                    <div className={`event-icon ${event.color}`}>
                      {event.icon}
                    </div>
                    {event.hasRewards && (
                      <div className="reward-badge">
                        <Award className="reward-icon" />
                      </div>
                    )}
                  </div>
                  <h3 className="event-name">{event.name}</h3>
                  <p className="event-desc">{event.description}</p>
                  {event.hasRewards && (
                    <div className="crypto-reward">
                      💰 Crypto rewards available
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Organize Events */}
          {canOrganize && (
            <div className="organize-section">
              <div className="organize-header">
                <h2 className="section-title">Organize an Event</h2>
                <p className="section-subtitle">
                  Create and manage healthcare events for your community
                </p>
              </div>
              <div className="organize-grid">
                {eventTypes.map((event) => (
                  <button
                    key={`organize-${event.id}`}
                    onClick={() => handleOrganizeEvent(event.id, event.name)}
                    className="organize-card"
                  >
                    <span className={`organize-icon ${event.color}`}>
                      {event.icon}
                    </span>
                    <div className="organize-text">Organize {event.name}</div>
                    <Plus className="plus-icon" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="info-section">
            <h2 className="section-title">How It Works</h2>
            <div className="info-grid">
              <div>
                <h3 className="info-title">For Participants</h3>
                <ul className="info-list">
                  <li>
                    <span className="step blue">1</span>Browse available events
                    by category
                  </li>
                  <li>
                    <span className="step blue">2</span>Register for events that
                    interest you
                  </li>
                  <li>
                    <span className="step blue">3</span>Attend the event and get
                    verified
                  </li>
                  <li>
                    <span className="step blue">4</span>Receive rewards for
                    blood donation events
                  </li>
                </ul>
              </div>
              {canOrganize && (
                <div>
                  <h3 className="info-title">For Organizers</h3>
                  <ul className="info-list">
                    <li>
                      <span className="step green">1</span>Choose the type of
                      event to organize
                    </li>
                    <li>
                      <span className="step green">2</span>Fill in event details
                      and schedule
                    </li>
                    <li>
                      <span className="step green">3</span>Manage registrations
                      and participants
                    </li>
                    <li>
                      <span className="step green">4</span>Verify participants
                      and distribute rewards
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventsMainPage;
