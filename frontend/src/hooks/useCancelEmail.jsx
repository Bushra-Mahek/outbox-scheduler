
import { useState } from "react";
import { emailApi } from "../api/emailApi";
import { getErrorMessage } from "../utils/errorHandler";

export const useCancelEmail = () => {
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");

  const cancelEmail = async (emailId) => {
    setLoadingId(emailId);
    setError("");

    try {
      const response = await emailApi.cancel(emailId);
      return response;
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoadingId(null);
    }
  };

  return {
    cancelEmail,
    loadingId,
    error
  };
};
