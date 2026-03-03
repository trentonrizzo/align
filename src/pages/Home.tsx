import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
  }

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: 480,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1>ALIGN</h1>
      <p>Compatibility-first dating.</p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "1.5rem",
        }}
      >
        {!user && (
          <>
            <Link
              to="/signup"
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #222",
                background: "#222",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Create Account
            </Link>
            <Link
              to="/login"
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #222",
                textDecoration: "none",
              }}
            >
              Log In
            </Link>
          </>
        )}
        {user && (
          <>
            <p style={{ marginBottom: "0.5rem" }}>
              Logged in as <strong>{user.email}</strong>
            </p>
            <Link
              to="/dashboard"
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #222",
                textDecoration: "none",
              }}
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem 0.75rem",
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
