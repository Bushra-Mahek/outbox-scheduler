
import { useState } from "react";
import { toLocalDateTimeInput } from "../../utils/dateFormatter";

const initialForm = {
  recipient: "",
  subject: "",
  body: "",
  scheduledAt: ""
};

const EmailForm = ({
  onSubmit,
  loading,
  error,
  success
}) => {
  const [form, setForm] = useState(initialForm);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await onSubmit({
        recipient: form.recipient.trim(),
        subject: form.subject.trim(),
        body: form.body,
        scheduledAt: new Date(form.scheduledAt).toISOString()
      });

      setForm(initialForm);
    } catch {
      // The parent hook owns and displays the error state.
    }
  };

  return (
    <section className="form-card">
      <h2>Schedule a new email</h2>
      <p className="muted">
        Enter the recipient and choose when to send.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="recipient">Recipient email</label>
        <input
          id="recipient"
          type="email"
          name="recipient"
          placeholder="recipient@example.com"
          value={form.recipient}
          onChange={handleChange}
          required
        />

        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          name="subject"
          placeholder="Enter email subject"
          value={form.subject}
          onChange={handleChange}
          required
          maxLength={500}
        />

        <label htmlFor="body">Email body</label>
        <textarea
          id="body"
          name="body"
          placeholder="Write your email..."
          value={form.body}
          onChange={handleChange}
          required
          rows={4}
        />

        <label htmlFor="scheduledAt">Schedule date and time</label>
        <input
          id="scheduledAt"
          type="datetime-local"
          name="scheduledAt"
          value={form.scheduledAt}
          onChange={handleChange}
          min={toLocalDateTimeInput()}
          required
        />

        <button className="submit-btn" disabled={loading}>
          {loading ? "Scheduling..." : "Schedule Email →"}
        </button>
      </form>

      {error && <p className="message error-message">{error}</p>}
      {success && <p className="message success-message">{success}</p>}
    </section>
  );
};

export default EmailForm;
