
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api/emails";

function App() {
  const [form, setForm] = useState({
    recipient: "",
    subject: "",
    body: "",
    scheduledAt: ""
  });

  const [scheduled, setScheduled] = useState([]);
  const [sent, setSent] = useState([]);
  const [activeTab, setActiveTab] = useState("scheduled");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadEmails = async () => {
    try {
      const [scheduledRes, sentRes] = await Promise.all([
        fetch(`${API}/scheduled`),
        fetch(`${API}/sent`)
      ]);

      if (!scheduledRes.ok || !sentRes.ok) {
        throw new Error("Could not load emails");
      }

      const scheduledData = await scheduledRes.json();
      const sentData = await sentRes.json();

      setScheduled(scheduledData.emails || []);
      setSent(sentData.emails || []);
    } catch (error) {
      setMessage("Backend connection failed. Check that the server is running.");
    }
  };

  useEffect(() => {
    loadEmails();
    const interval = setInterval(loadEmails, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const scheduleEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: new Date(form.scheduledAt).toISOString()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Scheduling failed");
      }

      setMessage("Email scheduled successfully!");
      setForm({ recipient: "", subject: "", body: "", scheduledAt: "" });
      await loadEmails();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelEmail = async (id) => {
    if (!window.confirm("Cancel this scheduled email?")) return;

    try {
      const response = await fetch(`${API}/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Cancellation failed");

      setMessage("Email cancelled successfully.");
      await loadEmails();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const emails = activeTab === "scheduled" ? scheduled : sent;

  const formatDate = (date) =>
    new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>✉ Outbox</h2>
        <p className="side-label">WORKSPACE</p>
        <button className="side-link active">▦ Dashboard</button>
        <button className="side-link" onClick={() => setActiveTab("scheduled")}>
          ◷ Scheduled
        </button>
        <button className="side-link" onClick={() => setActiveTab("sent")}>
          ✓ Sent emails
        </button>
        <div className="sidebar-bottom">Email Scheduling Platform</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Email Scheduler</h1>
            <p>Manage and schedule your email campaigns.</p>
          </div>
          <span className="online">● System dashboard</span>
        </header>

        <section className="stats">
          <div className="stat-card">
            <span>Scheduled emails</span>
            <h2>{scheduled.length}</h2>
          </div>
          <div className="stat-card">
            <span>Successfully sent</span>
            <h2>{sent.length}</h2>
          </div>
          <div className="stat-card">
            <span>Total processed</span>
            <h2>{scheduled.length + sent.length}</h2>
          </div>
        </section>

        <section className="form-card">
          <h2>Schedule a new email</h2>
          <p className="muted">Enter the recipient and choose when to send.</p>

          <form onSubmit={scheduleEmail}>
            <label>Recipient email</label>
            <input
              type="email"
              name="recipient"
              placeholder="recipient@example.com"
              value={form.recipient}
              onChange={handleChange}
              required
            />

            <label>Subject</label>
            <input
              name="subject"
              placeholder="Enter email subject"
              value={form.subject}
              onChange={handleChange}
              required
            />

            <label>Email body</label>
            <textarea
              name="body"
              placeholder="Write your email..."
              value={form.body}
              onChange={handleChange}
              required
              rows="4"
            />

            <label>Schedule date and time</label>
            <input
              type="datetime-local"
              name="scheduledAt"
              value={form.scheduledAt}
              onChange={handleChange}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16)}
              required
            />

            <button className="submit-btn" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule Email →"}
            </button>
          </form>

          {message && <p className="message">{message}</p>}
        </section>

        <section className="table-card">
          <div className="table-heading">
            <div>
              <h2>Email activity</h2>
              <p className="muted">Track your scheduled and sent emails.</p>
            </div>
            <button className="refresh-btn" onClick={loadEmails}>↻ Refresh</button>
          </div>

          <div className="tabs">
            <button
              className={activeTab === "scheduled" ? "tab selected" : "tab"}
              onClick={() => setActiveTab("scheduled")}
            >
              Scheduled ({scheduled.length})
            </button>
            <button
              className={activeTab === "sent" ? "tab selected" : "tab"}
              onClick={() => setActiveTab("sent")}
            >
              Sent ({sent.length})
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>{activeTab === "scheduled" ? "Scheduled at" : "Sent at"}</th>
                  <th>Status</th>
                  {activeTab === "scheduled" && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "scheduled" ? 5 : 4} className="empty">
                      No emails found.
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id}>
                      <td>{email.recipient}</td>
                      <td>{email.subject}</td>
                      <td>
                        {formatDate(
                          activeTab === "scheduled"
                            ? email.scheduled_at
                            : email.sent_at
                        )}
                      </td>
                      <td>
                        <span className={`status ${email.status}`}>
                          {email.status}
                        </span>
                      </td>
                      {activeTab === "scheduled" && (
                        <td>
                          <button
                            className="cancel-btn"
                            onClick={() => cancelEmail(email.id)}
                          >
                            Cancel
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
