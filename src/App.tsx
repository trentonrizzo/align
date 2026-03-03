import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import AlignedPage from "./pages/AlignedPage";
import ChatThreadPage from "./pages/ChatThreadPage";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import ProfilePhotos from "./pages/ProfilePhotos";
import AppShell from "./components/AppShell";
import { useAuth } from "./context/AuthContext";

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/profile/photos" element={<ProfilePhotos />} />
      </Route>
    </Routes>
  );
}
