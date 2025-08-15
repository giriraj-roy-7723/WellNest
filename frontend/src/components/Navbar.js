import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path) => {
    navigate(path);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2 className="navbar-title" onClick={() => handleNavigation("/")}>
          WellNest
        </h2>
      </div>
      
      <div className="navbar-menu">
        <button 
          className={`navbar-item ${isActive("/dashboard") ? "active" : ""}`}
          onClick={() => handleNavigation("/dashboard")}
        >
          Dashboard
        </button>
        <button 
          className={`navbar-item ${isActive("/doctors") ? "active" : ""}`}
          onClick={() => handleNavigation("/doctors")}
        >
          Doctors
        </button>
        <button 
          className={`navbar-item ${isActive("/ngos") ? "active" : ""}`}
          onClick={() => handleNavigation("/ngos")}
        >
          NGOs
        </button>
        <button 
          className={`navbar-item ${isActive("/healthworkers") ? "active" : ""}`}
          onClick={() => handleNavigation("/healthworkers")}
        >
          Health Workers
        </button>
        <button 
          className={`navbar-item ${isActive("/blogs") ? "active" : ""}`}
          onClick={() => handleNavigation("/blogs")}
        >
          Blogs
        </button>
        <button 
          className={`navbar-item ${isActive("/profile") ? "active" : ""}`}
          onClick={() => handleNavigation("/profile")}
        >
          Profile
        </button>
      </div>
      
      <div className="navbar-actions">
        <button className="btn btn-outline btn-small" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
