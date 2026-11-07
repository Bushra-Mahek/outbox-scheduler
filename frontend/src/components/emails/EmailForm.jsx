
import { useRef, useState } from "react";
import { toLocalDateTimeInput } from "../../utils/dateFormatter";

const initialForm = {
  campaignName: "",
  recipients: [],
  recipientInput: "",
  subject: "",
  body: "",
  scheduledAt: "",
  delaySeconds: 10,
  hourlyLimit: 100
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmailForm = ({ onSubmit, loading, error, success }) => {
  const [form, setForm] = useState(initialForm);
  const [validationError, setValidationError] = useState("");
  const fileInputRef = useRef(null);

  const updateField = (name, value) => {
    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
    setValidationError("");
  };

  const addRecipients = (rawValue) => {
    const candidates = rawValue
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const valid = candidates.filter((email) => EMAIL_REGEX.test(email));
    const invalid = candidates.filter((email) => !EMAIL_REGEX.test(email));

    setForm((previous) => {
      const existing = new Set(previous.recipients);
      const unique = valid.filter((email) => !existing.has(email));

      return {
        ...previous,
        recipients: [...previous.recipients, ...unique],
        recipientInput: ""
      };
    });

    if (invalid.length > 0) {
      setValidationError(
        `Invalid email address(es): ${invalid.slice(0, 3).join(", ")}`
      );
    } else {
      setValidationError("");
    }
  };

  const handleRecipientKeyDown = (event) => {
    if (
      event.key === "Enter" ||
      event.key === "," ||
      event.key === ";"
    ) {
      event.preventDefault();

      if (form.recipientInput.trim()) {
        addRecipients(form.recipientInput);
      }
    }

    if (
      event.key === "Backspace" &&
      !form.recipientInput &&
      form.recipients.length > 0
    ) {
      removeRecipient(form.recipients[form.recipients.length - 1]);
    }
  };

  const removeRecipient = (email) => {
    setForm((previous) => ({
      ...previous,
      recipients: previous.recipients.filter(
        (recipient) => recipient !== email
      )
    }));
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const extractedEmails =
        content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];

      if (extractedEmails.length === 0) {
        setValidationError("No email addresses found in this file.");
        return;
      }

      addRecipients(extractedEmails.join(","));
      setValidationError("");
    } catch {
      setValidationError("Unable to read the uploaded file.");
    }

    event.target.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setValidationError("");

    let finalRecipients = [...form.recipients];

    if (form.recipientInput.trim()) {
      const candidates = form.recipientInput
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const invalid = candidates.filter(
        (email) => !EMAIL_REGEX.test(email)
      );

      if (invalid.length > 0) {
        setValidationError("Please enter valid recipient email addresses.");
        return;
      }

      finalRecipients = [
        ...new Set([...finalRecipients, ...candidates])
      ];
    }

    if (finalRecipients.length === 0) {
      setValidationError("Add at least one recipient.");
      return;
    }

    if (!form.campaignName.trim()) {
      setValidationError("Please enter a campaign name.");
      return;
    }

    if (!form.subject.trim() || !form.body.trim()) {
      setValidationError("Subject and email body are required.");
      return;
    }

    const scheduledDate = new Date(form.scheduledAt);

    if (
      !form.scheduledAt ||
      Number.isNaN(scheduledDate.getTime()) ||
      scheduledDate.getTime() <= Date.now()
    ) {
      setValidationError("Select a valid future schedule date and time.");
      return;
    }

    const delaySeconds = Number(form.delaySeconds);
    const hourlyLimit = Number(form.hourlyLimit);

    if (!Number.isInteger(delaySeconds) || delaySeconds < 0) {
      setValidationError("Delay must be a non-negative whole number.");
      return;
    }

    if (!Number.isInteger(hourlyLimit) || hourlyLimit < 1) {
      setValidationError("Hourly limit must be at least 1.");
      return;
    }

    try {
      await onSubmit({
        campaignName: form.campaignName.trim(),
        recipients: finalRecipients,
        subject: form.subject.trim(),
        body: form.body.trim(),
        scheduledAt: scheduledDate.toISOString(),
        delaySeconds,
        hourlyLimit
      });

      setForm(initialForm);
    } catch {
      // API error is displayed through the parent hook.
    }
  };

  return (
    <section className="form-card">
      <div className="form-heading">
        <div>
          <h2>Compose Campaign</h2>
          <p className="muted">
            Create and schedule your email campaign.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="campaignName">Campaign name</label>
        <input
          id="campaignName"
          type="text"
          placeholder="e.g. November Product Launch"
          value={form.campaignName}
          onChange={(e) => updateField("campaignName", e.target.value)}
          maxLength={150}
          required
        />

        <label htmlFor="recipientInput">Recipients</label>

        <div className="recipient-input-container">
          <div className="recipient-chips">
            {form.recipients.map((email) => (
              <span className="recipient-chip" key={email}>
                {email}
                <button
                  type="button"
                  className="remove-recipient"
                  onClick={() => removeRecipient(email)}
                  aria-label={`Remove ${email}`}
                >
                  ×
                </button>
              </span>
            ))}

            <input
              id="recipientInput"
              type="text"
              placeholder="Enter email and press Enter"
              value={form.recipientInput}
              onChange={(e) =>
                updateField("recipientInput", e.target.value)
              }
              onKeyDown={handleRecipientKeyDown}
              onBlur={() => {
                if (form.recipientInput.trim()) {
                  addRecipients(form.recipientInput);
                }
              }}
            />
          </div>
        </div>

        <div className="recipient-actions">
          <span className="muted">
            {form.recipients.length} recipient(s) added
          </span>

          <button
            type="button"
            className="upload-csv-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload CSV / TXT
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            hidden
            onChange={handleCSVUpload}
          />
        </div>

        <label htmlFor="subject">Subject</label>
        <input
          id="subject"
          type="text"
          placeholder="Enter email subject"
          value={form.subject}
          onChange={(e) => updateField("subject", e.target.value)}
          maxLength={500}
          required
        />

        <label htmlFor="body">Email body</label>
        <textarea
          id="body"
          placeholder="Write your email..."
          value={form.body}
          onChange={(e) => updateField("body", e.target.value)}
          rows={6}
          required
        />

        <div className="campaign-settings">
          <div>
            <label htmlFor="scheduledAt">Start date and time</label>
            <input
              id="scheduledAt"
              type="datetime-local"
              value={form.scheduledAt}
              min={toLocalDateTimeInput()}
              onChange={(e) =>
                updateField("scheduledAt", e.target.value)
              }
              required
            />
          </div>

          <div>
            <label htmlFor="delaySeconds">
              Delay between emails (seconds)
            </label>
            <input
              id="delaySeconds"
              type="number"
              min="0"
              step="1"
              value={form.delaySeconds}
              onChange={(e) =>
                updateField("delaySeconds", e.target.value)
              }
              required
            />
          </div>

          <div>
            <label htmlFor="hourlyLimit">
              Hourly sending limit
            </label>
            <input
              id="hourlyLimit"
              type="number"
              min="1"
              step="1"
              value={form.hourlyLimit}
              onChange={(e) =>
                updateField("hourlyLimit", e.target.value)
              }
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
        >
          {loading ? "Scheduling campaign..." : "Schedule Campaign →"}
        </button>
      </form>

      {validationError && (
        <p className="message error-message">{validationError}</p>
      )}

      {error && (
        <p className="message error-message">{error}</p>
      )}

      {success && (
        <p className="message success-message">{success}</p>
      )}
    </section>
  );
};

export default EmailForm;
