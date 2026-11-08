
const BASE_URL = "http://localhost:5000/api";

export const authApi = {
  googleLogin: async (credential) => {
    const response = await fetch(`${BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Google login failed");
    }

    return data;
  }
};
