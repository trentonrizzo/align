import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { ConfirmModal } from "../components/ConfirmModal";

type Profile = {
  id: string;
  username: string | null;
  age: number | null;
  bio: string | null;
  gym: boolean | null;
  gamer: boolean | null;
  belief: string | null;
  music_pref: string | null;
  politics: string | null;
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      const currentUser = user;
      if (!currentUser) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        navigate("/setup-profile");
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  if (!user) {
    return <div>Loading...</div>;
  }

  function requestLogout() {
    setConfirmOpen(true);
  }

  async function handleConfirmLogout() {
    await signOut();
    setConfirmOpen(false);
    navigate("/login");
  }

  function handleCancelLogout() {
    setConfirmOpen(false);
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <button
          type="button"
          onClick={requestLogout}
          style={{
            padding: "0.4rem 0.75rem",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>

      {loading && (
        <p style={{ marginTop: 0 }}>Loading your profile...</p>
      )}

      {error && (
        <p style={{ marginTop: 0, color: "red" }}>{error}</p>
      )}

      {profile && !loading && !error && (
        <div
          style={{
            border: "1px solid #eee",
            padding: "1rem",
            borderRadius: 4,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Your profile</h2>
          <p>
            <strong>Username:</strong> {profile.username || "-"}
          </p>
          <p>
            <strong>Age:</strong> {profile.age ?? "-"}
          </p>
          <p>
            <strong>Bio:</strong> {profile.bio || "-"}
          </p>
          <p>
            <strong>Gym:</strong> {profile.gym ? "Yes" : "No"}
          </p>
          <p>
            <strong>Gamer:</strong> {profile.gamer ? "Yes" : "No"}
          </p>
          <p>
            <strong>Belief:</strong> {profile.belief || "-"}
          </p>
          <p>
            <strong>Music preference:</strong> {profile.music_pref || "-"}
          </p>
          <p>
            <strong>Politics:</strong> {profile.politics || "-"}
          </p>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        cancelLabel="Cancel"
        confirmLabel="Log out"
        onCancel={handleCancelLogout}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}
