import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./AlignedPage.css";

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  other_user_id: string;
  other_username: string | null;
  other_photo_path: string | null;
  last_message: string | null;
  last_message_at: string | null;
};

export default function AlignedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: matchesData, error: matchesErr } = await supabase
        .from("matches")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .order("created_at", { ascending: false });

      if (matchesErr) {
        setError(matchesErr.message);
        setLoading(false);
        return;
      }

      const rows: MatchRow[] = [];
      for (const m of matchesData ?? []) {
        const otherId = m.user_a === uid ? m.user_b : m.user_a;

        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("match_id", m.id)
          .maybeSingle();

        let last_message: string | null = null;
        let last_message_at: string | null = null;
        if (thread?.id) {
          const { data: lastMsg } = await supabase
            .from("chat_messages")
            .select("message, created_at")
            .eq("thread_id", thread.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg) {
            last_message = lastMsg.message;
            last_message_at = lastMsg.created_at;
          }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", otherId)
          .maybeSingle();

        const { data: photosData } = await supabase
          .from("profile_photos")
          .select("path")
          .eq("user_id", otherId)
          .order("position", { ascending: true })
          .limit(1);

        const firstPhoto = Array.isArray(photosData) ? photosData[0] : null;
        rows.push({
          id: m.id,
          user_a: m.user_a,
          user_b: m.user_b,
          created_at: m.created_at,
          other_user_id: otherId,
          other_username: profile?.username ?? null,
          other_photo_path: firstPhoto?.path ?? null,
          last_message: last_message ?? null,
          last_message_at,
        });
      }

      setMatches(rows);
      setLoading(false);
    }

    load();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="aligned-page">
        <div className="aligned-placeholder">Loading...</div>
      </div>
    );
  }

  function getPhotoUrl(path: string | null): string | null {
    if (!path) return null;
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  return (
    <div className="aligned-page">
      <div className="aligned-header">
        <h1 className="aligned-title">Aligned</h1>
        <p className="aligned-subtitle">Your matches • tap to chat</p>
      </div>

      {error && <div className="aligned-error">{error}</div>}

      {loading ? (
        <div className="aligned-skeleton">
          <div className="aligned-skeleton-row" />
          <div className="aligned-skeleton-row" />
          <div className="aligned-skeleton-row" />
        </div>
      ) : matches.length === 0 ? (
        <div className="aligned-empty">
          <p className="aligned-empty-title">No matches yet</p>
          <p className="aligned-empty-text">When you and someone else like each other on Discover, they’ll show up here.</p>
        </div>
      ) : (
        <ul className="aligned-list">
          {matches.map((m) => (
            <li
              key={m.id}
              className="aligned-card"
              onClick={() => navigate(`/aligned/chat/${m.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/aligned/chat/${m.id}`);
                }
              }}
            >
              <div className="aligned-card-photo">
                {m.other_photo_path && getPhotoUrl(m.other_photo_path) ? (
                  <img src={getPhotoUrl(m.other_photo_path)!} alt={m.other_username ?? "Profile"} />
                ) : (
                  <div className="aligned-card-placeholder" />
                )}
              </div>
              <div className="aligned-card-body">
                <div className="aligned-card-top">
                  <span className="aligned-card-name">{m.other_username ?? "Unknown"}</span>
                  <span className="aligned-badge">Aligned</span>
                </div>
                {m.last_message && (
                  <p className="aligned-card-preview">{m.last_message}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
