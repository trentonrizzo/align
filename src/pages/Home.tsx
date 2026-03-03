import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: "2rem", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <h1>ALIGN</h1>
      <p>Compatibility-first dating.</p>
      <nav style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
        <Link to="/login">Log in</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
    </div>
  );
}
