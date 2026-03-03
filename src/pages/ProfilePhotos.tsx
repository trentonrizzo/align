import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type ImageRow = {
  id: string;
  user_id: string;
  url?: string;
  path?: string;
  position: number;
  _source?: "profile_images" | "profile_photos";
};

const MAX_IMAGES = 10;

export default function ProfilePhotos() {
  const { user } = useAuth();

  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      if (!user) return;
      setLoading(true);
      setError(null);

      const { data: imgData } = await supabase
        .from("profile_images")
        .select("id, user_id, url, position")
        .eq("user_id", user.id)
        .order("position", { ascending: true });

      if (cancelled) return;

      if (imgData?.length) {
        setImages(
          imgData.map((r) => ({
            ...r,
            position: r.position ?? 0,
            _source: "profile_images" as const,
          })) as ImageRow[]
        );
      } else {
        const { data: photoData } = await supabase
          .from("profile_photos")
          .select("id, user_id, path, position")
          .eq("user_id", user.id)
          .order("position", { ascending: true });

        setImages(
          (photoData ?? []).map((r) => ({
            id: r.id,
            user_id: r.user_id,
            path: r.path,
            position: r.position ?? 0,
            _source: "profile_photos" as const,
          })) as ImageRow[]
        );
      }
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

  function getImageUrl(img: ImageRow): string {
    if (img.url) return img.url;
    if (img.path) {
      const { data } = supabase.storage.from("profile-photos").getPublicUrl(img.path);
      return data.publicUrl;
    }
    return "";
  }

  function nextPosition(existing: ImageRow[]): number {
    const used = new Set(existing.map((p) => p.position));
    for (let i = 0; i < MAX_IMAGES; i++) {
      if (!used.has(i)) return i;
    }
    return MAX_IMAGES - 1;
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length >= MAX_IMAGES) {
      setError(`You can upload up to ${MAX_IMAGES} photos.`);
      return;
    }

    setError(null);
    setUploading(true);

    const current = [...images];

    try {
      const toUpload = Array.from(files).slice(0, MAX_IMAGES - current.length);

      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${uuidv4()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
        const position = nextPosition(current);

        const { data: inserted, error: insertErr } = await supabase
          .from("profile_images")
          .insert({
            user_id: user.id,
            url: urlData.publicUrl,
            position,
          })
          .select()
          .single();

        if (insertErr) {
          await supabase.storage.from("profile-photos").remove([path]);
          throw insertErr;
        }

        current.push({ ...inserted, position } as ImageRow);
      }

      setImages(current);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(img: ImageRow) {
    setError(null);

    if (img.path) {
      await supabase.storage.from("profile-photos").remove([img.path]);
    }

    const table = img._source === "profile_photos" ? "profile_photos" : "profile_images";
    const { error: delErr } = await supabase.from(table).delete().eq("id", img.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }

    setImages((prev) => prev.filter((p) => p.id !== img.id));
    if (viewerIndex !== null && viewerIndex >= images.length - 1) {
      setViewerIndex(Math.max(0, viewerIndex - 1));
    }
  }

  async function handleReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const reordered = [...images];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);

    setImages(reordered.map((img, i) => ({ ...img, position: i })));

    const table = images[0]?._source === "profile_photos" ? "profile_photos" : "profile_images";
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from(table).update({ position: i }).eq("id", reordered[i].id);
    }
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
          Upload up to {MAX_IMAGES} profile photos.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          onChange={handleUpload}
          disabled={uploading || images.length >= MAX_IMAGES}
        />
        {uploading && <p style={{ marginTop: "0.5rem" }}>Uploading...</p>}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading photos...</p>
      ) : images.length === 0 ? (
        <p>No photos yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.id}
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
                  cursor: "pointer",
                }}
                onClick={() => setViewerIndex(i)}
              >
                <img
                  src={getImageUrl(img)}
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
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => handleReorder(i, i - 1)}
                    style={{ flex: 1, padding: "0.3rem", fontSize: "0.75rem" }}
                  >
                    ←
                  </button>
                )}
                {i < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => handleReorder(i, i + 1)}
                    style={{ flex: 1, padding: "0.3rem", fontSize: "0.75rem" }}
                  >
                    →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(img)}
                  style={{ flex: 1, padding: "0.3rem", fontSize: "0.75rem", color: "#c00" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewerIndex !== null && images[viewerIndex] && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setViewerIndex(null)}
        >
          <button
            type="button"
            onClick={() => setViewerIndex(null)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: "8px 16px",
              background: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Close
          </button>
          {viewerIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(viewerIndex - 1);
              }}
              style={{
                position: "absolute",
                left: 16,
                padding: "12px 20px",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
              }}
            >
              ‹
            </button>
          )}
          <img
            src={getImageUrl(images[viewerIndex])}
            alt=""
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
          {viewerIndex < images.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewerIndex(viewerIndex + 1);
              }}
              style={{
                position: "absolute",
                right: 16,
                padding: "12px 20px",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
              }}
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
