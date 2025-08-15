import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { getToken, removeToken } from "../utils/auth";
import Navbar from "../components/Navbar";
import WellnestSection from "../components/dashboard/WellnestSection";
import DoctorsSection from "../components/dashboard/DoctorsSection";
import NGOsSection from "../components/dashboard/NGOsSection";
import HealthWorkersSection from "../components/dashboard/HealthWorkersSection";
import ProfileSection from "../components/dashboard/ProfileSection";
import "../styles/dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("wellnest");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = getToken();
        if (!token) {
          navigate("/signin");
          return;
        }

        const res = await api.get("/auth/me");
        setUser(res.data.data.user);
      } catch (error) {
        console.error("Failed to fetch user:", error);
        removeToken();
        navigate("/signin");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    removeToken();
    navigate("/");
  };

  const renderSection = () => {
    switch (activeSection) {
      case "wellnest":
        return <WellnestSection user={user} />;
      case "doctors":
        return <DoctorsSection />;
      case "ngos":
        return <NGOsSection />;
      case "healthworkers":
        return <HealthWorkersSection />;
      case "profile":
        return <ProfileSection user={user} />;
      default:
        return <WellnestSection user={user} />;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-container">
      <Navbar 
        user={user} 
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
      />
      
      <main className="dashboard-main">
        <div className="dashboard-content">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
