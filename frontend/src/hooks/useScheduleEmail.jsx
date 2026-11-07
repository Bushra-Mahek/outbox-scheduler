
import { useState } from "react";
import { emailApi } from "../api/emailApi";
import { getErrorMessage } from "../utils/errorHandler";

export const useScheduleEmail = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const scheduleEmail = async (emailData) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await emailApi.schedule(emailData);
      setSuccess(response.message || "Email scheduled successfully!");
      return response;
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    scheduleEmail,
    loading,
    error,
    success,
    setError,
    setSuccess
  };
};
