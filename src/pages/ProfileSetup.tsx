import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ProfileForm } from "../components/ProfileForm";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
      <ProfileForm onAfterSave={() => navigate("/dashboard")} />
    </div>
  );
}


