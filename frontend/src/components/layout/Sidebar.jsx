
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  const links = [
    { label: "Dashboard", path: "/", icon: "▦", end: true },
    { label: "Scheduled", path: "/scheduled", icon: "◷" },
    { label: "Sent Emails", path: "/sent", icon: "✓" }
  ];

  return (
    <aside className="sidebar">
      <h2>✉ Outbox</h2>

      <p className="side-label">WORKSPACE</p>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.end}
            className={({ isActive }) =>
              `side-link ${isActive ? "active" : ""}`
            }
          >
            {link.icon} {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        Email Scheduling Platform
      </div>
    </aside>
  );
};

export default Sidebar;
