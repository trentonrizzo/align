import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import AlignedPage from "./pages/AlignedPage";
import ChatThreadPage from "./pages/ChatThreadPage";
import FavoritesPage from "./pages/FavoritesPage";
import NotificationsPage from "./pages/NotificationsPage";
import Profile from "./pages/Profile";
import ProfileViewerPage from "./pages/ProfileViewerPage";
import ProfileEdit from "./pages/ProfileEdit";
import ProfilePhotos from "./pages/ProfilePhotos";
import AppShell from "./components/AppShell";
import { useAuth } from "./context/AuthContext";
import { useProfileCompletion } from "./hooks/useProfileCompletion";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { loading: profileLoading, complete } = useProfileCompletion(user?.id ?? null);

  if (loading || profileLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Setting up your profile...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const inSetup = location.pathname.startsWith("/setup-profile");

  if (user && !complete && !inSetup) {
    return <Navigate to="/setup-profile" replace />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/setup-profile" element={<ProfileSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/aligned" element={<AlignedPage />} />
        <Route path="/aligned/chat/:matchId" element={<ChatThreadPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<ProfileViewerPage />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/profile/photos" element={<ProfilePhotos />} />
      </Route>
    </Routes>
  );
}
