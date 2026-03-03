import { ReactNode } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type AppShellProps = {
  children?: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const location = useLocation();

  const activePath = location.pathname;

  const inDashboard = activePath.startsWith("/dashboard");
  const inDiscover = activePath.startsWith("/discover");
  const inProfile = activePath.startsWith("/profile");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          paddingBottom: user ? "3.5rem" : 0,
        }}
      >
        {children ?? <Outlet />}
      </main>

      {user && (
        <nav
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            borderTop: "1px solid #ddd",
            backgroundColor: "#fff",
            padding: "0.4rem 0.75rem",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            zIndex: 500,
          }}
        >
          <NavItem to="/dashboard" label="Dashboard" active={inDashboard} />
          <NavItem to="/discover" label="Discover" active={inDiscover} />
          <NavItem to="/profile" label="Profile" active={inProfile} />
        </nav>
      )}
    </div>
  );
}

type NavItemProps = {
  to: string;
  label: string;
  active: boolean;
};

function NavItem({ to, label, active }: NavItemProps) {
  return (
    <Link
      to={to}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.1rem",
        flex: 1,
        fontSize: "0.8rem",
        textDecoration: "none",
        color: active ? "#111" : "#777",
        fontWeight: active ? 600 : 400,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          border: "1px solid",
          borderColor: active ? "#111" : "#bbb",
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </Link>
  );
}

