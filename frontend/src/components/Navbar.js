import React from "react";
import "../styles/navbar.css";

export default function Navbar({ user, activeSection, onSectionChange, onLogout }) {
  const navItems = [
    { id: "wellnest", label: "WellNest", icon: "🏠" },
    { id: "doctors", label: "Doctors", icon: "��‍⚕️" },
    { id: "ngos", label: "NGOs", icon: "🤝" },
    { id: "healthworkers", label: "Health Workers", icon: "🏥" },
    { id: "profile", label: "Profile", icon: "👤" }
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>WellNest</h1>
      </div>

      <div className="navbar-tabs">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-tab ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => onSectionChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="navbar-user">
        <div className="user-info">
          <span className="user-name">Welcome, {user?.firstName}</span>
          <span className="user-role">{user?.role}</span>
        </div>
        <button className="btn btn-outline" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
