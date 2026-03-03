import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { OG_LIMIT } from "../config/appConfig";
import { ProfileForm } from "../components/ProfileForm";
import { OgTicketModal } from "../components/OgTicketModal";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showOgModal, setShowOgModal] = useState(false);
  const [showSavedPill, setShowSavedPill] = useState(false);
  const [claiming, setClaiming] = useState(false);

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

  async function handleAfterSave() {
    if (!user) {
      setShowSavedPill(true);
      setTimeout(() => {
        setShowSavedPill(false);
        navigate("/dashboard", { replace: true });
      }, 1200);
      return;
    }

    const { data: existing } = await supabase
      .from("og_tickets")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      setShowSavedPill(true);
      setTimeout(() => {
        setShowSavedPill(false);
        navigate("/dashboard", { replace: true });
      }, 1200);
      return;
    }

    const { count } = await supabase
      .from("og_tickets")
      .select("user_id", { count: "exact", head: true });

    if (count == null || count >= OG_LIMIT) {
      setShowSavedPill(true);
      setTimeout(() => {
        setShowSavedPill(false);
        navigate("/dashboard", { replace: true });
      }, 1200);
      return;
    }

    setShowOgModal(true);
  }

  async function handleClaimOg() {
    if (!user) return;
    setClaiming(true);

    try {
      await supabase.from("og_tickets").insert({ user_id: user.id });
    } catch {
      // ignore errors (e.g., already exists)
    }

    setClaiming(false);
    setShowOgModal(false);
    setShowSavedPill(true);
    setTimeout(() => {
      setShowSavedPill(false);
      navigate("/dashboard", { replace: true });
    }, 1200);
  }

  return (
    <>
      {showSavedPill && (
        <div
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 20px",
            background: "#111",
            color: "#fff",
            borderRadius: 999,
            fontWeight: 700,
            zIndex: 9999,
            animation: "fadeInOut 1.2s ease-out",
          }}
        >
          Profile Saved
        </div>
      )}
      <div style={{ padding: "2rem", maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1rem" }}>Set up your ALIGN profile</h1>
        <p style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          Logged in as <strong>{user.email}</strong>
        </p>
        <ProfileForm onAfterSave={handleAfterSave} />
      </div>
      <OgTicketModal open={showOgModal} onClaim={handleClaimOg} claiming={claiming} />
    </>
  );
}


