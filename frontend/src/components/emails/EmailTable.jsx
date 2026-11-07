
import EmailStatus from "./EmailStatus";
import { formatDate } from "../../utils/dateFormatter";

const EmailTable = ({
  emails = [],
  type = "scheduled",
  onCancel,
  cancellingId
}) => {
  const isScheduled = type === "scheduled";

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Subject</th>
            <th>{isScheduled ? "Scheduled at" : "Sent at"}</th>
            <th>Status</th>
            {isScheduled && <th>Action</th>}
          </tr>
        </thead>

        <tbody>
          {emails.length === 0 ? (
            <tr>
              <td colSpan={isScheduled ? 5 : 4} className="empty">
                No {type} emails found.
              </td>
            </tr>
          ) : (
            emails.map((email) => (
              <tr key={email.id}>
                <td>{email.recipient}</td>
                <td title={email.subject}>{email.subject}</td>
                <td>
                  {formatDate(
                    isScheduled ? email.scheduled_at : email.sent_at
                  )}
                </td>
                <td>
                  <EmailStatus status={email.status} />
                </td>

                {isScheduled && (
                  <td>
                    <button
                      className="cancel-btn"
                      disabled={cancellingId === email.id}
                      onClick={() => onCancel(email.id)}
                    >
                      {cancellingId === email.id
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default EmailTable;
