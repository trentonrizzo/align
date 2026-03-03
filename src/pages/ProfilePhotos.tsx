import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type PhotoRow = {
  id: string;
  user_id: string;
  path: string;
  position: number | null;
  is_primary: boolean | null;
};

export default function ProfilePhotos() {
  const { user } = useAuth();

  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setPhotos((data as PhotoRow[]) ?? []);
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

  function getPhotoUrl(path: string) {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  function nextAvailablePosition(existing: PhotoRow[]): number {
    const used = new Set(
      existing
        .map((p) => p.position)
        .filter((p): p is number => typeof p === "number")
    );
    for (let i = 0; i < 6; i++) {
      if (!used.has(i)) return i;
    }
    return 5;
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length >= 6) {
      setError("You can upload up to 6 photos.");
      return;
    }

    setError(null);
    setUploading(true);

    const current = [...photos];

    try {
      const toUpload = Array.from(files).slice(0, 6 - current.length);

      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${uuidv4()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(path, file);

        if (uploadError) {
          throw uploadError;
        }

        const position = nextAvailablePosition(current);

        const isFirst = current.length === 0 && i === 0;

        const { data, error: insertError } = await supabase
          .from("profile_photos")
          .insert({
            user_id: user.id,
            path,
            position,
            is_primary: isFirst,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        current.push(data as PhotoRow);
      }

      setPhotos(current);
    } catch (err: any) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSetPrimary(photo: PhotoRow) {
    setError(null);

    const { error } = await supabase
      .from("profile_photos")
      .update({ is_primary: true })
      .eq("id", photo.id);

    if (error) {
      setError(error.message);
      return;
    }

    const { error: clearError } = await supabase
      .from("profile_photos")
      .update({ is_primary: false })
      .eq("user_id", user.id)
      .neq("id", photo.id);

    if (clearError) {
      setError(clearError.message);
      return;
    }

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id ? { ...p, is_primary: true } : { ...p, is_primary: false }
      )
    );
  }

  async function handleDelete(photo: PhotoRow) {
    setError(null);

    const { error: storageError } = await supabase.storage
      .from("profile-photos")
      .remove([photo.path]);

    if (storageError) {
      setError(storageError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("profile_photos")
      .delete()
      .eq("id", photo.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Manage photos</h1>

      <div
        style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        <p style={{ marginTop: 0, marginBottom: "0.5rem" }}>
          Upload up to 6 profile photos.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          onChange={handleUpload}
          disabled={uploading || photos.length >= 6}
        />
        {uploading && <p style={{ marginTop: "0.5rem" }}>Uploading...</p>}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading photos...</p>
      ) : photos.length === 0 ? (
        <p>No photos yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "100%",
                  paddingBottom: "100%",
                  position: "relative",
                  borderRadius: 6,
                  overflow: "hidden",
                  marginBottom: "0.5rem",
                }}
              >
                <img
                  src={getPhotoUrl(photo.path)}
                  alt="Profile"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem" }}>
                Position: {photo.position ?? "-"}
              </p>
              <p style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>
                {photo.is_primary ? "Primary" : "Secondary"}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.25rem",
                  marginTop: "0.25rem",
                }}
              >
                {!photo.is_primary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(photo)}
                    style={{
                      flex: 1,
                      padding: "0.3rem 0.4rem",
                      border: "1px solid #222",
                      background: "#fff",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Set primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  style={{
                    flex: 1,
                    padding: "0.3rem 0.4rem",
                    border: "1px solid #ccc",
                    background: "#fff",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

