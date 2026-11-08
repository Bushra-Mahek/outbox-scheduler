
const BASE_URL = "http://localhost:5000/api";

export const apiRequest = async (endpoint, options = {}) => {
  let response;

  const token = localStorage.getItem("outbox_token");

  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error("Unable to connect to the server.");
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (response.status === 401) {
    localStorage.removeItem("outbox_token");
    localStorage.removeItem("outbox_user");

    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }

    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status})`
    );
  }

  return data;
};
