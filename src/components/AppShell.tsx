import type { ReactNode } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUnreadAlignedCount } from "../hooks/useUnreadAlignedCount";
import { useUnreadNotificationsCount } from "../hooks/useUnreadNotificationsCount";

type AppShellProps = {
  children?: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const location = useLocation();
  const unreadAligned = useUnreadAlignedCount(user?.id);
  const unreadNotifications = useUnreadNotificationsCount(user?.id);

  const activePath = location.pathname;
  const inSetup = activePath.startsWith("/setup-profile");

  const inDashboard = activePath.startsWith("/dashboard");
  const inDiscover = activePath.startsWith("/discover");
  const inAligned = activePath.startsWith("/aligned");
  const inFavorites = activePath.startsWith("/favorites");
  const inNotifications = activePath.startsWith("/notifications");
  const inProfile = activePath === "/profile" || activePath.startsWith("/profile/edit") || activePath.startsWith("/profile/photos");

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
          paddingBottom: user && !inSetup ? "3.5rem" : 0,
        }}
      >
        {children ?? <Outlet />}
      </main>

      {user && !inSetup && (
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
          <NavItem to="/aligned" label="Aligned" active={inAligned} badge={unreadAligned} />
          <NavItem to="/favorites" label="Favorites" active={inFavorites} />
          <NavItem to="/notifications" label="Notifications" active={inNotifications} badge={unreadNotifications} />
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
  badge?: number;
};

function NavItem({ to, label, active, badge = 0 }: NavItemProps) {
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
        position: "relative",
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
      {badge > 0 && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: "50%",
            transform: "translate(8px, 0)",
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 8,
            background: "#e53935",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span>{label}</span>
    </Link>
  );
}

