
import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/authApi";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");

      const result = await authApi.googleLogin(
        credentialResponse.credential
      );

      localStorage.setItem("outbox_token", result.token);
      localStorage.setItem("outbox_user", JSON.stringify(result.user));

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Login</h1>
        <p className="login-subtitle">Welcome to Outbox Scheduler</p>

        <div className="google-login-container">
          {loading ? (
            <p>Signing you in...</p>
          ) : (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in was unsuccessful")}
              theme="filled_green"
              text="signin_with"
              shape="rectangular"
              width="100%"
            />
          )}
        </div>

        {error && <p className="error-message">{error}</p>}
      </section>
    </main>
  );
}
