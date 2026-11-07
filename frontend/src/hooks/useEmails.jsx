
import { useCallback, useEffect, useState } from "react";
import { emailApi } from "../api/emailApi";
import { getErrorMessage } from "../utils/errorHandler";

const extractEmails = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.emails)) return response.emails;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export const useEmails = () => {
  const [scheduled, setScheduled] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refreshEmails = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshEmails(true);

    const intervalId = setInterval(() => {
      refreshEmails(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [refreshEmails]);

  return {
    scheduled,
    sent,
    loading,
    refreshing,
    error,
    refreshEmails
  };
};
