import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { ConfirmModal } from "../components/ConfirmModal";

type ProfileRow = {
  id: string;
  username: string | null;
  age: number | null;
  bio: string | null;
  gym: boolean | null;
  gamer: boolean | null;
  belief: string | null;
  music_pref: string | null;
  politics: string | null;
};

type PhotoRow = {
  id: string;
  user_id: string;
  path: string;
  position: number | null;
  is_primary: boolean | null;
};

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const currentUser = user;
      if (!currentUser) return;

      const [{ data: profileData, error: profileError }, { data: photosData, error: photosError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("profile_photos")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("position", { ascending: true }),
        ]);

      if (cancelled) return;

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (photosError) {
        setError(photosError.message);
        setLoading(false);
        return;
      }

      setProfile((profileData as ProfileRow | null) ?? null);
      setPhotos((photosData as PhotoRow[]) ?? []);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return <div>Loading...</div>;
  }

  function requestLogout() {
    setConfirmOpen(true);
  }

  async function handleConfirmLogout() {
    await signOut();
    setConfirmOpen(false);
    navigate("/login");
  }

  function handleCancelLogout() {
    setConfirmOpen(false);
  }

  const primaryPhoto = photos.find((p) => p.is_primary);
  const otherPhotos = photos.filter((p) => !p.is_primary);

  function getPhotoUrl(path: string) {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Profile</h1>
        <button
          type="button"
          onClick={requestLogout}
          style={{
            padding: "0.4rem 0.75rem",
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <>
          <section
            style={{
              marginBottom: "1.5rem",
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: "1rem",
            }}
          >
            <div>
              <div
                style={{
                  width: "100%",
                  paddingBottom: "100%",
                  position: "relative",
                  backgroundColor: "#f3f3f3",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {primaryPhoto ? (
                  <img
                    src={getPhotoUrl(primaryPhoto.path)}
                    alt="Primary profile"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#888",
                      fontSize: "0.9rem",
                    }}
                  >
                    No primary photo
                  </div>
                )}
              </div>
              {otherPhotos.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                    overflowX: "auto",
                  }}
                >
                  {otherPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={getPhotoUrl(photo.path)}
                      alt="Profile thumbnail"
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: "cover",
                        borderRadius: 6,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "1rem",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                Details
              </h2>
              <p>
                <strong>Username:</strong> {profile?.username || "-"}
              </p>
              <p>
                <strong>Age:</strong> {profile?.age ?? "-"}
              </p>
              <p>
                <strong>Bio:</strong> {profile?.bio || "-"}
              </p>
              <p>
                <strong>Gym:</strong> {profile?.gym ? "Yes" : "No"}
              </p>
              <p>
                <strong>Gamer:</strong> {profile?.gamer ? "Yes" : "No"}
              </p>
              <p>
                <strong>Belief:</strong> {profile?.belief || "-"}
              </p>
              <p>
                <strong>Music preference:</strong> {profile?.music_pref || "-"}
              </p>
              <p>
                <strong>Politics:</strong> {profile?.politics || "-"}
              </p>
            </div>
          </section>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/profile/edit")}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #222",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => navigate("/profile/photos")}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #222",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Manage photos
            </button>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        cancelLabel="Cancel"
        confirmLabel="Log out"
        onCancel={handleCancelLogout}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}

