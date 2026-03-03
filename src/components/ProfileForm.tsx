import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { TraitPillSelect } from "./TraitPillSelect";

type ProfileFormProps = {
  onAfterSave: () => void;
};

type TraitSelectionSummary = {
  selectedIds: string[];
  byCategory: Record<string, string[]>;
};

export function ProfileForm({ onAfterSave }: ProfileFormProps) {
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [age, setAge] = useState<string>("");
  const [bio, setBio] = useState("");
  const [gym, setGym] = useState(false);
  const [gamer, setGamer] = useState(false);

  const [traits, setTraits] = useState<TraitSelectionSummary>({
    selectedIds: [],
    byCategory: {},
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  const hasCategory = (cat: string) => (traits.byCategory[cat]?.length ?? 0) > 0;

  const missingRequired =
    username.trim() === "" ||
    age.trim() === "" ||
    !hasCategory("belief") ||
    !hasCategory("music") ||
    !hasCategory("politics");

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
        setAge(data.age != null ? String(data.age) : "");
        setBio(data.bio ?? "");
        setGym(Boolean(data.gym));
        setGamer(Boolean(data.gamer));
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

    const beliefLabel = traits.byCategory.belief?.[0] ?? "";
    const musicLabel = traits.byCategory.music?.[0] ?? "";
    const politicsLabel = traits.byCategory.politics?.[0] ?? "";

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      username,
      age: age.trim() === "" ? null : Number(age),
      bio,
      gym,
      gamer,
      belief: beliefLabel,
      music_pref: musicLabel,
      politics: politicsLabel,
    });

    if (profileError) {
      setError(profileError.message);
      setSubmitting(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("profile_traits")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
      setSubmitting(false);
      return;
    }

    if (traits.selectedIds.length > 0) {
      const rows = traits.selectedIds.map((id) => ({
        user_id: user.id,
        trait_option_id: id,
      }));
      const { error: insertError } = await supabase.from("profile_traits").insert(rows);
      if (insertError) {
        setError(insertError.message);
        setSubmitting(false);
        return;
      }
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
          onChange={(e) => setAge(e.target.value)}
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
        onSelectionChange={(info) => setTraits(info)}
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
