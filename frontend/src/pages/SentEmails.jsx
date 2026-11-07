
import MainLayout from "../components/layout/MainLayout";
import EmailTable from "../components/emails/EmailTable";
import { useEmails } from "../hooks/useEmails";

const SentEmails = () => {
  const { sent, loading, error, refreshEmails } = useEmails();

  return (
    <MainLayout activePage="sent">
      <header className="topbar">
        <div>
          <h1>Sent Emails</h1>
          <p>View emails successfully processed by the worker.</p>
        </div>
      </header>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Email history</h2>
            <p className="muted">
              {sent.length} sent email(s)
            </p>
          </div>

          <button className="refresh-btn" onClick={refreshEmails}>
            ↻ Refresh
          </button>
        </div>

        {error && (
          <p className="message error-message">{error}</p>
        )}

        {loading ? (
          <p className="empty">Loading sent emails...</p>
        ) : (
          <EmailTable emails={sent} type="sent" />
        )}
      </section>
    </MainLayout>
  );
};

export default SentEmails;
