
import MainLayout from "../components/layout/MainLayout";
import EmailTable from "../components/emails/EmailTable";
import { useEmails } from "../hooks/useEmails";
import { useCancelEmail } from "../hooks/useCancelEmail";

const ScheduledEmails = () => {
  const {
    scheduled,
    loading,
    error,
    refreshEmails
  } = useEmails();

  const { cancelEmail, loadingId, error: cancelError } = useCancelEmail();

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this scheduled email?")) return;

    try {
      await cancelEmail(id);
      await refreshEmails();
    } catch {
      // Error is displayed below.
    }
  };

  return (
    <MainLayout activePage="scheduled">
      <header className="topbar">
        <div>
          <h1>Scheduled Emails</h1>
          <p>Manage your upcoming email deliveries.</p>
        </div>
      </header>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Upcoming emails</h2>
            <p className="muted">
              {scheduled.length} scheduled email(s)
            </p>
          </div>

          <button className="refresh-btn" onClick={refreshEmails}>
            ↻ Refresh
          </button>
        </div>

        {(error || cancelError) && (
          <p className="message error-message">
            {error || cancelError}
          </p>
        )}

        {loading ? (
          <p className="empty">Loading scheduled emails...</p>
        ) : (
          <EmailTable
            emails={scheduled}
            type="scheduled"
            onCancel={handleCancel}
            cancellingId={loadingId}
          />
        )}
      </section>
    </MainLayout>
  );
};
export default ScheduledEmails;
