import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [gym, setGym] = useState(false);
  const [gamer, setGamer] = useState(false);
  const [music, setMusic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!user) {
      setError("You must be logged in to set up a profile.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      username,
      age: age === "" ? null : Number(age),
      bio,
      gym,
      gamer,
      music,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    navigate("/dashboard");
  }

  if (!user) {
    return (
      <div style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1rem" }}>Set up your ALIGN profile</h1>
        <p style={{ marginBottom: "1rem" }}>Not logged in.</p>
        <Link
          to="/login"
          style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid #222",
            textDecoration: "none",
          }}
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Set up your ALIGN profile</h1>
      <p style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
        Logged in as <strong>{user.email}</strong>
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Username</span>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Age</span>
          <input
            type="number"
            min={18}
            value={age}
            onChange={(e) =>
              setAge(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Bio</span>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          />
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={gym}
            onChange={(e) => setGym(e.target.checked)}
          />
          <span>Gym</span>
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={gamer}
            onChange={(e) => setGamer(e.target.checked)}
          />
          <span>Gamer</span>
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Music</span>
          <input
            type="text"
            value={music}
            onChange={(e) => setMusic(e.target.value)}
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
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </form>
    </div>
  );
}

