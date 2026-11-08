
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Sidebar() {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("outbox_user") || "null");
  } catch {
    user = null;
  }

  const handleLogout = () => {
    localStorage.removeItem("outbox_token");
    localStorage.removeItem("outbox_user");
    navigate("/login", { replace: true });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map(part => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <aside className="sidebar">

      {/* Brand */}
      <div
        className="brand"
        onClick={() => navigate("/")}
        role="button"
      >
        <span className="brand-mark">O</span>
        <span>UTBOX</span>
      </div>

      {/* User profile */}
      <div className="profile-wrapper">
        <button
          className="profile"
          onClick={() => setProfileOpen(!profileOpen)}
          aria-expanded={profileOpen}
        >
          <div className="avatar">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name || "Profile"}
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </div>

          <div className="profile-info">
            <strong>{user?.name || "User"}</strong>
            <small>{user?.email || "Google account"}</small>
          </div>

          <span className="profile-chevron">
            {profileOpen ? "⌃" : "⌄"}
          </span>
        </button>

        {profileOpen && (
          <div className="profile-dropdown">
            <div className="profile-dropdown-info">
              <strong>{user?.name || "User"}</strong>
              <small>{user?.email || ""}</small>
            </div>

            <button onClick={handleLogout}>
              ↪ Sign out
            </button>
          </div>
        )}
      </div>

      {/* Compose */}
      <button
        className="compose-button"
        onClick={() => navigate("/compose")}
      >
        + Compose
      </button>

      {/* Navigation */}
      <div className="sidebar-label">CORE</div>

      <nav className="sidebar-nav">

        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `side-link ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-icon">⌂</span>
          <span>Inbox</span>
        </NavLink>

        <NavLink
          to="/scheduled"
          className={({ isActive }) =>
            `side-link ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-icon">◷</span>
          <span>Scheduled</span>
        </NavLink>

        <NavLink
          to="/sent"
          className={({ isActive }) =>
            `side-link ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-icon">➤</span>
          <span>Sent</span>
        </NavLink>

      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="online-dot" />
        Outbox Scheduler
      </div>

      <button
        className="logout-button"
        onClick={handleLogout}
      >
        ↪ Logout
      </button>

    </aside>
  );
}
