import { useEffect, useState, useCallback } from "react";
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
  other_photo_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  chat_id: string | null;
};

export default function AlignedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;

    setLoading(true);
    setError(null);

    const blockedIds = new Set<string>();
    const { data: blocks } = await supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
    blocks?.forEach((b: { blocker_id: string; blocked_id: string }) => {
      if (b.blocker_id === uid) blockedIds.add(b.blocked_id);
      else blockedIds.add(b.blocker_id);
    });

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
      if (blockedIds.has(otherId)) continue;

      let chatId: string | null = null;
      let last_message: string | null = null;
      let last_message_at: string | null = null;
      let unread_count = 0;

      const { data: chat } = await supabase
        .from("chats")
        .select("id")
        .eq("match_id", m.id)
        .maybeSingle();

      if (chat?.id) {
        chatId = chat.id;
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("body, created_at, sender_id, read_at")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastMsg) {
          last_message = lastMsg.body;
          last_message_at = lastMsg.created_at;
        }
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("chat_id", chat.id)
          .neq("sender_id", uid)
          .is("read_at", null);
        unread_count = count ?? 0;
      } else {
        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("match_id", m.id)
          .maybeSingle();
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
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", otherId)
        .maybeSingle();

      let photoPath: string | null = null;
      let photoUrl: string | null = null;
      const { data: img } = await supabase
        .from("profile_images")
        .select("url")
        .eq("user_id", otherId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (img?.url) photoUrl = img.url;
      else {
        const { data: photosData } = await supabase
          .from("profile_photos")
          .select("path")
          .eq("user_id", otherId)
          .order("position", { ascending: true })
          .limit(1);
        const firstPhoto = Array.isArray(photosData) ? photosData[0] : null;
        photoPath = firstPhoto?.path ?? null;
      }

      rows.push({
        id: m.id,
        user_a: m.user_a,
        user_b: m.user_b,
        created_at: m.created_at,
        other_user_id: otherId,
        other_username: profile?.username ?? null,
        other_photo_path: photoPath,
        other_photo_url: photoUrl,
        last_message: last_message ?? null,
        last_message_at,
        unread_count,
        chat_id: chatId,
      });
    }

    setMatches(rows);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const channel = supabase
      .channel("aligned-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadMatches()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => loadMatches()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => loadMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadMatches]);

  if (!user) {
    return (
      <div className="aligned-page">
        <div className="aligned-placeholder">Loading...</div>
      </div>
    );
  }

  function getPhotoUrl(m: MatchRow): string | null {
    if (m.other_photo_url) return m.other_photo_url;
    if (m.other_photo_path) {
      const { data } = supabase.storage.from("profile-photos").getPublicUrl(m.other_photo_path);
      return data.publicUrl;
    }
    return null;
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
          <p className="aligned-empty-text">When you and someone else like each other on Discover, they'll show up here.</p>
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
                {getPhotoUrl(m) ? (
                  <img src={getPhotoUrl(m)!} alt={m.other_username ?? "Profile"} />
                ) : (
                  <div className="aligned-card-placeholder" />
                )}
                {m.unread_count > 0 && <span className="aligned-unread-dot" aria-label="Unread" />}
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
