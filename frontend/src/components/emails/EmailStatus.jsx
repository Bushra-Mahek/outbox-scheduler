
const EmailStatus = ({ status }) => {
  return (
    <span className={`status ${status}`}>
      {status}
    </span>
  );
};

export default EmailStatus;
