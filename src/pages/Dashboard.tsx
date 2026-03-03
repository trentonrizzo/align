import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1>Dashboard</h1>
      <p>Your matches and alignment scores will appear here.</p>
      <Link to="/">&larr; Home</Link>
    </div>
  );
}
