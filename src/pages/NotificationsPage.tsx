import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./NotificationsPage.css";

type NotificationRow = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [mutedTypes, setMutedTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    async function loadMutes() {
      const { data } = await supabase
        .from("notification_mutes")
        .select("mute_type")
        .eq("user_id", uid);
      setMutedTypes(new Set((data ?? []).map((r) => r.mute_type)));
    }

    loadMutes();
  }, [user?.id]);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("notifications")
        .select("id, type, title, body, data, is_read, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      setNotifications((data ?? []) as NotificationRow[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("notifications-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function markAsRead(id: string) {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function toggleMute(muteType: string) {
    if (!user) return;
    const isMuted = mutedTypes.has(muteType);
    if (isMuted) {
      await supabase.from("notification_mutes").delete().eq("user_id", user.id).eq("mute_type", muteType);
      setMutedTypes((prev) => {
        const next = new Set(prev);
        next.delete(muteType);
        return next;
      });
    } else {
      await supabase.from("notification_mutes").insert({ user_id: user.id, mute_type: muteType });
      setMutedTypes((prev) => new Set(prev).add(muteType));
    }
  }

  const filtered = notifications.filter((n) => !mutedTypes.has(n.type));

  if (!user) {
    return (
      <div className="notifications-page">
        <div className="notifications-placeholder">Loading...</div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <button type="button" className="notifications-back" onClick={() => navigate(-1)}>
          Back
        </button>
        <h1 className="notifications-title">Notifications</h1>
      </header>

      <div className="notifications-mutes">
        <span className="notifications-mutes-label">Mute:</span>
        {["messages", "favorites", "matches"].map((t) => (
          <button
            key={t}
            type="button"
            className={`notifications-mute-btn ${mutedTypes.has(t) ? "notifications-mute-btn--on" : ""}`}
            onClick={() => toggleMute(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="notifications-error">{error}</div>}

      {loading ? (
        <div className="notifications-skeleton">
          <div className="notifications-skeleton-row" />
          <div className="notifications-skeleton-row" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="notifications-empty">
          <p>No notifications</p>
        </div>
      ) : (
        <ul className="notifications-list">
          {filtered.map((n) => (
            <li
              key={n.id}
              className={`notifications-item ${!n.is_read ? "notifications-item--unread" : ""}`}
              onClick={() => !n.is_read && markAsRead(n.id)}
            >
              <div className="notifications-item-type">{n.type}</div>
              <div className="notifications-item-content">
                <strong>{n.title ?? n.type}</strong>
                {n.body && <p>{n.body}</p>}
              </div>
              <div className="notifications-item-time">
                {new Date(n.created_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
