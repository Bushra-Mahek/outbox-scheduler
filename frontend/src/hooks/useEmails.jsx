
import { useCallback, useEffect, useState } from "react";
import { emailApi } from "../api/emailApi";
import { getErrorMessage } from "../utils/errorHandler";

const extractEmails = (response) => {
  return response.emails || response.data || [];
};

export const useEmails = () => {
  const [scheduled, setScheduled] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshEmails = useCallback(async () => {
    try {
      setError("");

      const [scheduledResponse, sentResponse] = await Promise.all([
        emailApi.getScheduled(),
        emailApi.getSent()
      ]);

      setScheduled(extractEmails(scheduledResponse));
      setSent(extractEmails(sentResponse));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEmails();

    const intervalId = setInterval(refreshEmails, 5000);

    return () => clearInterval(intervalId);
  }, [refreshEmails]);

  return {
    scheduled,
    sent,
    loading,
    error,
    refreshEmails
  };
};
