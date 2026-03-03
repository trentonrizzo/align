import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error } = await signIn({ email, password });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("Login failed.");
      setSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setSubmitting(false);
      return;
    }

    if (!profile) {
      navigate("/setup-profile");
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 380, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Log in</h1>
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
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Need an account? <Link to="/signup">Sign up</Link>
      </p>
      <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
        <Link to="/">&larr; Back home</Link>
      </p>
    </div>
  );
}
