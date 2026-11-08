
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import EmailForm from "../components/emails/EmailForm";
import { useScheduleEmail } from "../hooks/useScheduleEmail";

export default function ComposeEmail() {
  const navigate = useNavigate();

  const {
    scheduleEmail,
    loading,
    error,
    success
  } = useScheduleEmail();

  const handleSubmit = async (data) => {
    await scheduleEmail(data);
    navigate("/scheduled");
  };

  return (
    <MainLayout>
      <div className="compose-page">
        <header className="compose-header">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ←
          </button>
          <h2>Compose New Email</h2>
        </header>

        <EmailForm
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          success={success}
        />
      </div>
    </MainLayout>
  );
}
