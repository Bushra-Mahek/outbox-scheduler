
const Sidebar = ({ activePage = "dashboard" }) => {
  const links = [
    { label: "Dashboard", path: "/", key: "dashboard", icon: "▦" },
    { label: "Scheduled", path: "/scheduled", key: "scheduled", icon: "◷" },
    { label: "Sent Emails", path: "/sent", key: "sent", icon: "✓" }
  ];

  return (
    <aside className="sidebar">
      <h2>✉ Outbox</h2>

      <p className="side-label">WORKSPACE</p>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <a
            key={link.key}
            href={link.path}
            className={`side-link ${
              activePage === link.key ? "active" : ""
            }`}
          >
            {link.icon} {link.label}
          </a>
        ))}
      </nav>

      <div className="sidebar-bottom">
        Email Scheduling Platform
      </div>
    </aside>
  );
};

export default Sidebar;
