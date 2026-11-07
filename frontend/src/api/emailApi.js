
import { apiRequest } from "./apiClient";

export const emailApi = {
  getAll: () => apiRequest("/emails"),

  getScheduled: () => apiRequest("/emails/scheduled"),

  getSent: () => apiRequest("/emails/sent"),

  schedule: (emailData) =>
    apiRequest("/emails", {
      method: "POST",
      body: JSON.stringify(emailData)
    }),

  cancel: (emailId) =>
    apiRequest(`/emails/${emailId}`, {
      method: "DELETE"
    })
};
