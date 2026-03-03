import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchTraitOptionsGrouped } from "../lib/traitOptions";
import { TraitPillSelect } from "./TraitPillSelect";

type ProfileFormProps = {
  onAfterSave: () => void;
};

export function ProfileForm({ onAfterSave }: ProfileFormProps) {
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [gym, setGym] = useState(false);
  const [gamer, setGamer] = useState(false);

  const [primaryTraits, setPrimaryTraits] = useState({
    belief: "",
    music: "",
    politics: "",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  const missingRequired =
    primaryTraits.belief.trim() === "" ||
    primaryTraits.music.trim() === "" ||
    primaryTraits.politics.trim() === "";

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      const currentUser = user;
      if (!currentUser) return;

      const { data, error: err } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      if (data) {
        setUsername(data.username ?? "");
        setAge(data.age ?? "");
        setBio(data.bio ?? "");
        setGym(Boolean(data.gym));
        setGamer(Boolean(data.gamer));
        setPrimaryTraits({
          belief: data.belief ?? "",
          music: data.music_pref ?? "",
          politics: data.politics ?? "",
        });
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // One-time sync: if profile has belief/music_pref/politics but no profile_traits yet, seed them
  useEffect(() => {
    if (!user || !primaryTraits.belief || !primaryTraits.music || !primaryTraits.politics) return;

    let cancelled = false;

    async function syncTraits() {
      const { data: existing } = await supabase
        .from("profile_traits")
        .select("trait_option_id")
        .eq("user_id", user!.id)
        .limit(1);
      if (cancelled || (existing && existing.length > 0)) return;

      const opts = await fetchTraitOptionsGrouped();
      const toInsert: { user_id: string; trait_option_id: string }[] = [];
      for (const [label, list] of [
        [primaryTraits.belief, opts.belief ?? []],
        [primaryTraits.music, opts.music ?? []],
        [primaryTraits.politics, opts.politics ?? []],
      ] as [string, { id: string; label: string }[]][]) {
        const option = list.find((o) => o.label === label);
        if (option) toInsert.push({ user_id: user!.id, trait_option_id: option.id });
      }
      if (toInsert.length) await supabase.from("profile_traits").upsert(toInsert, { onConflict: "user_id,trait_option_id" });
    }

    syncTraits();
    return () => {
      cancelled = true;
    };
  }, [user?.id, primaryTraits.belief, primaryTraits.music, primaryTraits.politics]);

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

    const { error: err } = await supabase.from("profiles").upsert({
      id: user.id,
      username,
      age: age === "" ? null : Number(age),
      bio,
      gym,
      gamer,
      belief: primaryTraits.belief,
      music_pref: primaryTraits.music,
      politics: primaryTraits.politics,
    });

    if (err) {
      setError(err.message);
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

      <TraitPillSelect
        userId={user.id}
        onTraitsChange={(t) =>
          setPrimaryTraits((prev) => {
            if (!t.belief && !t.music && !t.politics && (prev.belief || prev.music || prev.politics)) return prev;
            return { belief: t.belief ?? prev.belief, music: t.music ?? prev.music, politics: t.politics ?? prev.politics };
          })
        }
      />

      {showRequiredErrors && missingRequired && (
        <p className="trait-pill-error" style={{ fontSize: "0.875rem", color: "#c00" }}>
          Please add at least one option for Belief, Music, and Politics.
        </p>
      )}

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
