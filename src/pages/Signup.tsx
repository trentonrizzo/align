import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const { data, error } = await signUp({ email, password });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setInfo(
        "Check your email to confirm your account, then log in with your credentials."
      );
      setSubmitting(false);
      navigate("/login");
      return;
    }

    navigate("/setup-profile");
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 400, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Create Account</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          />
        </label>
        {error && (
          <div style={{ color: "red", fontSize: "0.875rem" }}>{error}</div>
        )}
        {info && (
          <div style={{ color: "green", fontSize: "0.875rem" }}>{info}</div>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.5rem 0.75rem",
            border: "none",
            background: "#222",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
        <Link to="/">&larr; Back home</Link>
      </p>
    </div>
  );
}

