import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { SearchableSelect, Option } from "./SearchableSelect";

type ProfileFormProps = {
  onAfterSave: () => void;
};

const beliefOptions: Option[] = [
  { value: "Atheist", label: "Atheist" },
  { value: "Atheist/Agnostic", label: "Atheist/Agnostic" },
  { value: "Agnostic", label: "Agnostic" },
  { value: "Non-religious", label: "Non-religious" },
  { value: "Christian", label: "Christian" },
  { value: "Muslim", label: "Muslim" },
  { value: "Hindu", label: "Hindu" },
  { value: "Buddhist", label: "Buddhist" },
  { value: "Jewish", label: "Jewish" },
  { value: "Spiritual (not religious)", label: "Spiritual (not religious)" },
  { value: "Other", label: "Other" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const musicOptions: Option[] = [
  { value: "I don't care", label: "I don't care" },
  { value: "Multi-genre", label: "Multi-genre" },
  { value: "Pop", label: "Pop" },
  { value: "Hip-hop/Rap", label: "Hip-hop/Rap" },
  { value: "Rock", label: "Rock" },
  { value: "Metal", label: "Metal" },
  { value: "Deathcore/Death Metal", label: "Deathcore/Death Metal" },
  { value: "Country", label: "Country" },
  { value: "EDM", label: "EDM" },
  { value: "Jazz", label: "Jazz" },
  { value: "Classical", label: "Classical" },
  { value: "Other", label: "Other" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const politicsOptions: Option[] = [
  { value: "Left / Liberal", label: "Left / Liberal" },
  { value: "Center / Moderate", label: "Center / Moderate" },
  { value: "Right / Conservative", label: "Right / Conservative" },
  { value: "Apolitical", label: "Apolitical" },
  { value: "Both suck", label: "Both suck" },
  { value: "Other", label: "Other" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

export function ProfileForm({ onAfterSave }: ProfileFormProps) {
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [gym, setGym] = useState(false);
  const [gamer, setGamer] = useState(false);

  const [belief, setBelief] = useState("");
  const [musicPref, setMusicPref] = useState("");
  const [politics, setPolitics] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  const missingRequired =
    belief.trim() === "" || musicPref.trim() === "" || politics.trim() === "";

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setUsername(data.username ?? "");
        setAge(data.age ?? "");
        setBio(data.bio ?? "");
        setGym(Boolean(data.gym));
        setGamer(Boolean(data.gamer));
        setBelief(data.belief ?? "");
        setMusicPref(data.music_pref ?? "");
        setPolitics(data.politics ?? "");
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowRequiredErrors(true);

    if (missingRequired) {
      return;
    }

    if (!user) {
      setError("You must be logged in to edit your profile.");
      return;
    }

    setSubmitting(true);

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

    setSubmitting(false);
    onAfterSave();
  }

  if (!user) {
    return (
      <p style={{ marginTop: "1rem" }}>
        You must be logged in to edit your profile.
      </p>
    );
  }

  if (loading) {
    return <p>Loading profile...</p>;
  }

  return (
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

      <SearchableSelect
        label="Belief / Religious affiliation"
        required
        value={belief}
        onChange={setBelief}
        options={beliefOptions}
        pinnedValues={[
          "Atheist",
          "Atheist/Agnostic",
          "Agnostic",
          "Non-religious",
        ]}
        error={
          showRequiredErrors && belief.trim() === ""
            ? "Please select a belief preference."
            : null
        }
      />

      <SearchableSelect
        label="Music preference"
        required
        value={musicPref}
        onChange={setMusicPref}
        options={musicOptions}
        error={
          showRequiredErrors && musicPref.trim() === ""
            ? "Please select a music preference."
            : null
        }
      />

      <SearchableSelect
        label="Politics"
        required
        value={politics}
        onChange={setPolitics}
        options={politicsOptions}
        error={
          showRequiredErrors && politics.trim() === ""
            ? "Please select a political preference."
            : null
        }
      />

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
  );
}

