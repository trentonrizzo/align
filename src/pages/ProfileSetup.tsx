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

  const [belief, setBelief] = useState("");
  const [musicPref, setMusicPref] = useState("");
  const [politics, setPolitics] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  const missingRequired =
    belief.trim() === "" || musicPref.trim() === "" || politics.trim() === "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowRequiredErrors(true);

    if (missingRequired) {
      return;
    }

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
      belief,
      music_pref: musicPref,
      politics,
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
    <div style={{ padding: "2rem", maxWidth: 520, margin: "0 auto" }}>
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

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Belief / Religious affiliation *</span>
          <select
            value={belief}
            onChange={(e) => setBelief(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          >
            <option value="">Select...</option>
            <option value="Atheist">Atheist</option>
            <option value="Atheist/Agnostic">Atheist/Agnostic</option>
            <option value="Agnostic">Agnostic</option>
            <option value="Non-religious">Non-religious</option>
            <option value="Christian">Christian</option>
            <option value="Muslim">Muslim</option>
            <option value="Hindu">Hindu</option>
            <option value="Buddhist">Buddhist</option>
            <option value="Jewish">Jewish</option>
            <option value="Spiritual (not religious)">
              Spiritual (not religious)
            </option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          {showRequiredErrors && belief.trim() === "" && (
            <span style={{ color: "red", fontSize: "0.8rem" }}>
              Please select a belief preference.
            </span>
          )}
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Music preference *</span>
          <select
            value={musicPref}
            onChange={(e) => setMusicPref(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          >
            <option value="">Select...</option>
            <option value="I don't care">I don't care</option>
            <option value="Multi-genre">Multi-genre</option>
            <option value="Pop">Pop</option>
            <option value="Hip-hop/Rap">Hip-hop/Rap</option>
            <option value="Rock">Rock</option>
            <option value="Metal">Metal</option>
            <option value="Deathcore/Death Metal">Deathcore/Death Metal</option>
            <option value="Country">Country</option>
            <option value="EDM">EDM</option>
            <option value="Jazz">Jazz</option>
            <option value="Classical">Classical</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          {showRequiredErrors && musicPref.trim() === "" && (
            <span style={{ color: "red", fontSize: "0.8rem" }}>
              Please select a music preference.
            </span>
          )}
        </label>

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Politics *</span>
          <select
            value={politics}
            onChange={(e) => setPolitics(e.target.value)}
            style={{ padding: "0.5rem", border: "1px solid #ccc" }}
          >
            <option value="">Select...</option>
            <option value="Left / Liberal">Left / Liberal</option>
            <option value="Center / Moderate">Center / Moderate</option>
            <option value="Right / Conservative">Right / Conservative</option>
            <option value="Apolitical">Apolitical</option>
            <option value="Both suck">Both suck</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          {showRequiredErrors && politics.trim() === "" && (
            <span style={{ color: "red", fontSize: "0.8rem" }}>
              Please select a political preference.
            </span>
          )}
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

        {error && (
          <div style={{ color: "red", fontSize: "0.875rem" }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting || missingRequired}
          style={{
            padding: "0.5rem 0.75rem",
            border: "none",
            background: "#222",
            color: "#fff",
            cursor: submitting || missingRequired ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </form>
    </div>
  );
}

