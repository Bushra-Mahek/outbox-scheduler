
import MainLayout from "../components/layout/MainLayout";
import StatsCards from "../components/dashboard/StatsCards";
import EmailForm from "../components/emails/EmailForm";
import EmailTable from "../components/emails/EmailTable";

import { useEmails } from "../hooks/useEmails";
import { useScheduleEmail } from "../hooks/useScheduleEmail";
import { useCancelEmail } from "../hooks/useCancelEmail";

const Dashboard = () => {
  const {
    scheduled,
    sent,
    loading,
    error: fetchError,
    refreshEmails
  } = useEmails();

  const {
    scheduleEmail,
    loading: scheduling,
    error: scheduleError,
    success
  } = useScheduleEmail();

  const {
    cancelEmail,
    loadingId,
    error: cancelError
  } = useCancelEmail();

  const handleSchedule = async (emailData) => {
    await scheduleEmail(emailData);
    await refreshEmails();
  };

  const handleCancel = async (emailId) => {
    if (!window.confirm("Are you sure you want to cancel this email?")) {
      return;
    }

    try {
      await cancelEmail(emailId);
      await refreshEmails();
    } catch {
      // Cancellation error is exposed by useCancelEmail.
    }
  };

  return (
    <MainLayout activePage="dashboard">
      <header className="topbar">
        <div>
          <h1>Email Scheduler</h1>
          <p>Manage and schedule your email campaigns.</p>
        </div>
        <span className="online">● System dashboard</span>
      </header>

      <StatsCards
        scheduledCount={scheduled.length}
        sentCount={sent.length}
      />

      <EmailForm
        onSubmit={handleSchedule}
        loading={scheduling}
        error={scheduleError}
        success={success}
      />

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>Email activity</h2>
            <p className="muted">
              Track your scheduled and sent emails.
            </p>
          </div>

          <button className="refresh-btn" onClick={refreshEmails}>
            ↻ Refresh
          </button>
        </div>

        {(fetchError || cancelError) && (
          <p className="message error-message">
            {fetchError || cancelError}
          </p>
        )}

        {loading ? (
          <p className="empty">Loading emails...</p>
        ) : (
          <>
            <h3 className="section-label">Scheduled emails</h3>
            <EmailTable
              emails={scheduled}
              type="scheduled"
              onCancel={handleCancel}
              cancellingId={loadingId}
            />

            <h3 className="section-label">Sent emails</h3>
            <EmailTable emails={sent} type="sent" />
          </>
        )}
      </section>
    </MainLayout>
  );
};

export default Dashboard;
