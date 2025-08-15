import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import DoctorsPage from "./pages/DoctorsPage";
import NGOsPage from "./pages/NGOsPage";
import HealthWorkersPage from "./pages/HealthWorkersPage";
import ProfilePage from "./pages/ProfilePage";
import BlogsPage from "./pages/BlogsPage";
import "./styles/main.css";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/ngos" element={<NGOsPage />} />
          <Route path="/healthworkers" element={<HealthWorkersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/blogs" element={<BlogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
