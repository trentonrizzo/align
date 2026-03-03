import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div style={{ padding: "2rem", maxWidth: 380, margin: "0 auto" }}>
      <h1>Log in</h1>
      <p>Auth will be wired to Supabase.</p>
      <Link to="/">&larr; Home</Link>
    </div>
  );
}
