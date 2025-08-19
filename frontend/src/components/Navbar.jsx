import React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Calendar } from "lucide-react";

export default function Navbar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/doctors", label: "Doctors" },
    { path: "/ngos", label: "NGOs" },
    { path: "/healthworkers", label: "Health Workers" },
    { path: "/events", label: "Events", icon: <Calendar size={14} /> }, // ✅ Events added
    { path: "/blogs", label: "Blogs" },
    { path: "/payment", label: "Donate" },
    { path: "/profile", label: "Profile" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2 className="navbar-title" onClick={() => navigate("/")}>
          WellNest
        </h2>
      </div>

      <div className="navbar-menu">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`navbar-item ${isActive(item.path) ? "active" : ""}`}
          >
            {item.icon && (
              <span style={{ marginRight: "5px" }}>{item.icon}</span>
            )}
            {item.label}
          </Link>
        ))}
      </div>

      <div className="navbar-actions">
        <button className="btn btn-outline btn-small" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
