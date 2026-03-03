import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ProfileForm } from "../components/ProfileForm";

export default function ProfileEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div style={{ padding: "2rem", maxWidth: 520, margin: "0 auto" }}>
        <h1>Edit profile</h1>
        <p>You are not logged in.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Edit profile</h1>
      <ProfileForm onAfterSave={() => navigate("/profile")} />
    </div>
  );
}

