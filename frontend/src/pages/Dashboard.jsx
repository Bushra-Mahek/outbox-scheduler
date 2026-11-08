
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { useEmails } from "../hooks/useEmails";

export default function Dashboard() {
  const { scheduled = [], sent = [], loading, error, refreshEmails } = useEmails();
  const [search, setSearch] = useState("");
  const [starred, setStarred] = useState([]);
  const navigate = useNavigate();

  const emails = useMemo(() => {
    const combined = [
      ...scheduled.map(email => ({ ...email, displayStatus: "Scheduled" })),
      ...sent.map(email => ({ ...email, displayStatus: "Sent" }))
    ];

    return combined.filter(email => {
      const text = [
        email.recipient,
        email.subject,
        email.body,
        email.status
      ].join(" ").toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [scheduled, sent, search]);

  const toggleStar = (id) => {
    setStarred(previous =>
      previous.includes(id)
        ? previous.filter(item => item !== id)
        : [...previous, id]
    );
  };

  return (
    <MainLayout>
      <div className="mail-toolbar">
        <div className="search-box">
          <span>⌕</span>
          <input
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button className="icon-button" title="Filter">▽</button>
        <button
          className="icon-button"
          onClick={refreshEmails}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {error && <div className="notice error-message">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading emails...</div>
      ) : emails.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✉</div>
          <h3>No emails found</h3>
          <p>Your email activity will appear here.</p>
        </div>
      ) : (
        <div className="inbox-list">
          {emails.map((email, index) => {
            const id = email.id;
            const isStarred = starred.includes(id);

            return (
              <div className="email-row" key={id || index}>
                <button
                  className={`star-button ${isStarred ? "starred" : ""}`}
                  onClick={() => toggleStar(id)}
                  title="Star email"
                >
                  {isStarred ? "★" : "☆"}
                </button>

                <div className="email-row-content">
                  <div className="email-primary">
                    <strong>To: {email.recipient}</strong>
                    <span className={`mail-status ${email.displayStatus.toLowerCase()}`}>
                      {email.displayStatus}
                    </span>
                    <span className="email-subject">{email.subject}</span>
                  </div>

                  <p className="email-preview">
                    {email.body || "No message preview available"}
                  </p>
                </div>

                <time className="email-time">
                  {email.scheduled_at
                    ? new Date(email.scheduled_at).toLocaleString()
                    : ""}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </MainLayout>
  );
}
