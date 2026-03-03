import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchProfileTraits } from "../lib/traitOptions";
import "./FavoritesPage.css";

type FavoriteRow = {
  target_user_id: string;
  created_at: string;
  username: string | null;
  age: number | null;
  bio: string | null;
  belief: string | null;
  music_pref: string | null;
  politics: string | null;
  gym: boolean | null;
  gamer: boolean | null;
  photo_url: string | null;
  compatibility: number;
  traits: string[];
};

function computeCompatibility(
  me: { belief?: string; music_pref?: string; politics?: string; gym?: boolean; gamer?: boolean },
  other: { belief?: string; music_pref?: string; politics?: string; gym?: boolean; gamer?: boolean }
): number {
  let numer = 0;
  let denom = 0;
  if (me.belief != null && other.belief != null) {
    denom += 30;
    if (me.belief === other.belief) numer += 30;
  }
  if (me.politics != null && other.politics != null) {
    denom += 25;
    if (me.politics === other.politics) numer += 25;
  }
  if (me.music_pref != null && other.music_pref != null) {
    denom += 15;
    if (me.music_pref === other.music_pref) numer += 15;
  }
  if (me.gym != null && other.gym != null) {
    denom += 15;
    if (me.gym === other.gym) numer += 15;
  }
  if (me.gamer != null && other.gamer != null) {
    denom += 15;
    if (me.gamer === other.gamer) numer += 15;
  }
  if (denom === 0) return 50;
  return Math.round((numer / denom) * 100);
}

function badgeTone(pct: number) {
  if (pct >= 85) return "fav-badge fav-badge--hot";
  if (pct >= 70) return "fav-badge fav-badge--good";
  if (pct >= 50) return "fav-badge fav-badge--mid";
  return "fav-badge fav-badge--low";
}

export default function FavoritesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: favs, error: favErr } = await supabase
        .from("favorites")
        .select("target_user_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (favErr) {
        setError(favErr.message);
        setLoading(false);
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("belief, music_pref, politics, gym, gamer")
        .eq("id", uid)
        .maybeSingle();

      const rows: FavoriteRow[] = [];
      for (const f of favs ?? []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, age, bio, belief, music_pref, politics, gym, gamer")
          .eq("id", f.target_user_id)
          .maybeSingle();

        let photoUrl: string | null = null;
        const { data: img } = await supabase
          .from("profile_images")
          .select("url")
          .eq("user_id", f.target_user_id)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (img?.url) photoUrl = img.url;
        else {
          const { data: ph } = await supabase
            .from("profile_photos")
            .select("path")
            .eq("user_id", f.target_user_id)
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (ph?.path) {
            const { data } = supabase.storage.from("profile-photos").getPublicUrl(ph.path);
            photoUrl = data.publicUrl;
          }
        }

        const traits: string[] = [];
        try {
          const { byCategory } = await fetchProfileTraits(f.target_user_id);
          if (byCategory.belief) traits.push(byCategory.belief.label);
          if (byCategory.music) traits.push(byCategory.music.label);
          if (byCategory.politics) traits.push(byCategory.politics.label);
        } catch {
          if (profile?.belief) traits.push(profile.belief);
          if (profile?.music_pref) traits.push(profile.music_pref);
          if (profile?.politics) traits.push(profile.politics);
        }
        if (profile?.gym) traits.push("Gym");
        if (profile?.gamer) traits.push("Gamer");

        const compatibility = myProfile
          ? computeCompatibility(myProfile, profile ?? {})
          : 50;

        rows.push({
          target_user_id: f.target_user_id,
          created_at: f.created_at,
          username: profile?.username ?? null,
          age: profile?.age ?? null,
          bio: profile?.bio ?? null,
          belief: profile?.belief ?? null,
          music_pref: profile?.music_pref ?? null,
          politics: profile?.politics ?? null,
          gym: profile?.gym ?? null,
          gamer: profile?.gamer ?? null,
          photo_url: photoUrl,
          compatibility,
          traits,
        });
      }

      setRows(rows);
      setLoading(false);
    }

    load();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="favorites-page">
        <div className="favorites-placeholder">Loading...</div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <header className="favorites-header">
        <h1 className="favorites-title">Favorites</h1>
        <p className="favorites-subtitle">People you've favorited</p>
      </header>

      {error && <div className="favorites-error">{error}</div>}

      {loading ? (
        <div className="favorites-skeleton">
          <div className="favorites-skeleton-row" />
          <div className="favorites-skeleton-row" />
          <div className="favorites-skeleton-row" />
        </div>
      ) : rows.length === 0 ? (
        <div className="favorites-empty">
          <p className="favorites-empty-title">No favorites yet</p>
          <p className="favorites-empty-text">Tap the star on Discover to add people to your favorites.</p>
        </div>
      ) : (
        <ul className="favorites-list">
          {rows.map((r) => (
            <li
              key={r.target_user_id}
              className="favorites-card"
              onClick={() => navigate(`/profile/${r.target_user_id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/profile/${r.target_user_id}`);
                }
              }}
            >
              <div className="favorites-card-photo">
                {r.photo_url ? (
                  <img src={r.photo_url} alt={r.username ?? "Profile"} />
                ) : (
                  <div className="favorites-card-placeholder" />
                )}
              </div>
              <div className="favorites-card-body">
                <div className="favorites-card-top">
                  <span className="favorites-card-name">
                    {r.username ?? "Unknown"}
                    {r.age != null ? <span className="favorites-card-age"> {r.age}</span> : null}
                  </span>
                  <span className={badgeTone(r.compatibility)}>{r.compatibility}% aligned</span>
                </div>
                <div className="favorites-card-traits">
                  {r.traits.map((t) => (
                    <span key={t} className="favorites-pill">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
