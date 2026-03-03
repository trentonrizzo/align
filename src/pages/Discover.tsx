import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchTraitOptionsGrouped, type TraitOptionByCategory } from "../lib/traitOptions";
import "./discover.css";

type DiscoverRow = {
  user_id: string;
  username: string | null;
  age: number | null;
  bio: string | null;
  gym: boolean | null;
  gamer: boolean | null;
  belief: string | null;
  music_preference: string | null;
  politics: string | null;
  distance_miles: number | null;
  compatibility: number | null;
  photos: Array<{ url?: string; path?: string; sort?: number }>;
  is_favorited: boolean;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function getPhotoUrl(photo: { url?: string; path?: string }): string | null {
  if (photo.url) return photo.url;
  if (photo.path) {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(photo.path);
    return data.publicUrl;
  }
  return null;
}

function fmtMiles(mi: number | null) {
  if (mi == null) return "—";
  if (mi < 0.2) return "<0.2 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

function badgeTone(pct: number) {
  if (pct >= 85) return "badge badge--hot";
  if (pct >= 70) return "badge badge--good";
  if (pct >= 50) return "badge badge--mid";
  return "badge badge--low";
}

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DiscoverRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Filters (hard filters)
  const [onlyNearby, setOnlyNearby] = useState(true);
  const [maxMiles, setMaxMiles] = useState(50);
  const [belief, setBelief] = useState<string>("");
  const [music, setMusic] = useState<string>("");
  const [politics, setPolitics] = useState<string>("");
  const [gym, setGym] = useState<boolean | null>(null);
  const [gamer, setGamer] = useState<boolean | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [traitOptionsByCategory, setTraitOptionsByCategory] = useState<TraitOptionByCategory | null>(null);

  useEffect(() => {
    fetchTraitOptionsGrouped().then(setTraitOptionsByCategory).catch(() => {});
  }, []);

  const filters = useMemo(() => {
    const f: Record<string, unknown> = {
      onlyNearby,
      maxMiles: clamp(maxMiles, 1, 500),
    };
    if (belief) f.belief = belief;
    if (music) f.music_preference = music;
    if (politics) f.politics = politics;
    if (gym !== null) f.gym = gym;
    if (gamer !== null) f.gamer = gamer;
    return f;
  }, [onlyNearby, maxMiles, belief, music, politics, gym, gamer]);

  async function updateMyLocation(uid: string) {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 0);

        await supabase
          .from("profiles")
          .update({
            latitude,
            longitude,
            location_accuracy_meters: accuracy,
            location_updated_at: new Date().toISOString(),
            location_hidden: false,
          })
          .eq("id", uid);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }

  async function load(p = 0) {
    if (!user) return;
    setLoading(true);
    setErr(null);

    try {
      const uid = user.id;
      if (p === 0) updateMyLocation(uid);

      const limit = 20;
      const offset = p * limit;

      const { data, error } = await supabase.rpc("discover_profiles", {
        p_user_id: uid,
        p_limit: limit,
        p_offset: offset,
        p_filters: filters,
      });

      if (error) throw error;

      const mapped: DiscoverRow[] = (data || []).map((r: Record<string, unknown>) => ({
        ...r,
        photos: Array.isArray(r.photos) ? (r.photos as DiscoverRow["photos"]) : [],
      }));

      setRows(mapped);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load discover feed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(0);
    if (user) load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, user?.id]);

  async function handleAlign(toUserId: string) {
    if (!user) return;
    const { error } = await supabase.from("align_requests").insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      status: "pending",
    });
    if (!error) {
      setRows((prev) => prev.filter((r) => r.user_id !== toUserId));
    }
  }

  async function toggleFavorite(targetUserId: string, isFav: boolean) {
    if (!user) return;

    setRows((prev) =>
      prev.map((r) => (r.user_id === targetUserId ? { ...r, is_favorited: !isFav } : r))
    );

    const favTable = "favorites";
    if (!isFav) {
      const { error } = await supabase
        .from(favTable)
        .insert({ user_id: user.id, target_user_id: targetUserId });
      if (error) {
        setRows((prev) =>
          prev.map((r) => (r.user_id === targetUserId ? { ...r, is_favorited: isFav } : r))
        );
      }
    } else {
      const { error } = await supabase
        .from(favTable)
        .delete()
        .eq("user_id", user.id)
        .eq("target_user_id", targetUserId);
      if (error) {
        setRows((prev) =>
          prev.map((r) => (r.user_id === targetUserId ? { ...r, is_favorited: isFav } : r))
        );
      }
    }
  }

  if (!user) {
    return (
      <div className="discover">
        <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
      </div>
    );
  }

  const hero = rows[0];

  return (
    <div className="discover">
      <div className="discover__topbar">
        <div className="discover__titleWrap">
          <div className="discover__title">Discover</div>
          <div className="discover__subtitle">Nearby first • alignment score • hard filters</div>
        </div>

        <div className="discover__actions">
          <button className="btn btn--ghost" onClick={() => setFilterOpen(true)}>
            Filters
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setPage(0);
              load(0);
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="notice notice--err">{err}</div>}

      {loading ? (
        <div className="skeleton">
          <div className="skeleton__card" />
          <div className="skeleton__row" />
          <div className="skeleton__row" />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty__title">No matches found</div>
          <div className="empty__text">
            Try widening distance or removing hard filters. (Or create a few test accounts.)
          </div>
          <button className="btn" onClick={() => setFilterOpen(true)}>
            Open Filters
          </button>
        </div>
      ) : (
        <div className="grid">
          <div className="card card--hero">
            <div className="card__media">
              {hero?.photos?.[0] && getPhotoUrl(hero.photos[0]) ? (
                <img src={getPhotoUrl(hero.photos[0])!} alt={hero.username ?? "Profile"} />
              ) : (
                <div className="card__placeholder">
                  <div className="card__placeholderText">No photo</div>
                </div>
              )}

              <div className="card__overlay">
                <div className="row">
                  <div className="name">
                    {hero.username ?? "Unknown"}
                    {hero.age != null ? <span className="age"> {hero.age}</span> : null}
                  </div>
                  <div className={badgeTone(hero.compatibility ?? 50)}>
                    {hero.compatibility ?? 50}% aligned
                  </div>
                </div>

                <div className="meta">
                  <span className="pill">{fmtMiles(hero.distance_miles)}</span>
                  {hero.belief ? <span className="pill">{hero.belief}</span> : null}
                  {hero.music_preference ? <span className="pill">{hero.music_preference}</span> : null}
                  {hero.politics ? <span className="pill">{hero.politics}</span> : null}
                  {hero.gym ? <span className="pill">Gym</span> : null}
                  {hero.gamer ? <span className="pill">Gamer</span> : null}
                </div>
              </div>
            </div>

            <div className="card__body">
              <div className="bio">{hero.bio ? hero.bio : "No bio yet."}</div>

              <div className="ctaRow">
                <button
                  className="btn"
                  onClick={() => handleAlign(hero.user_id)}
                >
                  Align
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => toggleFavorite(hero.user_id, hero.is_favorited)}
                >
                  {hero.is_favorited ? "★ Favorited" : "☆ Favorite"}
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => navigate(`/profile/${hero.user_id}`)}
                >
                  View Profile
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => setRows((prev) => prev.slice(1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="list">
            <div className="list__title">More nearby</div>

            {rows.slice(1, 8).map((r) => (
              <div
                className="mini"
                key={r.user_id}
                onClick={() => navigate(`/profile/${r.user_id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/profile/${r.user_id}`);
                  }
                }}
              >
                <div className="mini__img">
                  {r.photos?.[0] && getPhotoUrl(r.photos[0]) ? (
                    <img src={getPhotoUrl(r.photos[0])!} alt={r.username ?? "Profile"} />
                  ) : (
                    <div className="mini__ph" />
                  )}
                </div>

                <div className="mini__mid">
                  <div className="mini__top">
                    <div className="mini__name">
                      {r.username ?? "Unknown"}
                      {r.age != null ? <span className="mini__age"> {r.age}</span> : null}
                    </div>
                    <div className={badgeTone(r.compatibility ?? 50)}>{r.compatibility ?? 50}%</div>
                  </div>

                  <div className="mini__meta">
                    <span className="pill pill--thin">{fmtMiles(r.distance_miles)}</span>
                    {r.belief ? <span className="pill pill--thin">{r.belief}</span> : null}
                    {r.music_preference ? <span className="pill pill--thin">{r.music_preference}</span> : null}
                    {r.gym ? <span className="pill pill--thin">Gym</span> : null}
                    {r.gamer ? <span className="pill pill--thin">Gamer</span> : null}
                  </div>
                </div>

                <div className="mini__right" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="iconBtn"
                    title="Align"
                    onClick={() => handleAlign(r.user_id)}
                  >
                    ♥
                  </button>
                  <button
                    className="iconBtn"
                    title="Favorite"
                    onClick={() => toggleFavorite(r.user_id, r.is_favorited)}
                  >
                    {r.is_favorited ? "★" : "☆"}
                  </button>
                </div>
              </div>
            ))}

            <div className="pager">
              <button
                className="btn btn--ghost"
                disabled={page === 0}
                onClick={() => {
                  const p = Math.max(0, page - 1);
                  setPage(p);
                  load(p);
                }}
              >
                Prev
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  load(p);
                }}
              >
                Next page
              </button>
            </div>
          </div>
        </div>
      )}

      {filterOpen && (
        <div className="drawerBackdrop" onClick={() => setFilterOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer__top">
              <div className="drawer__title">Filters</div>
              <button className="btn btn--ghost" onClick={() => setFilterOpen(false)}>
                Close
              </button>
            </div>

            <div className="drawer__section">
              <label className="rowLine">
                <span>Only nearby</span>
                <input
                  type="checkbox"
                  checked={onlyNearby}
                  onChange={(e) => setOnlyNearby(e.target.checked)}
                />
              </label>

              <label className="field">
                <span>Max miles</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxMiles}
                  onChange={(e) => setMaxMiles(parseInt(e.target.value || "50", 10))}
                />
              </label>
            </div>

            <div className="drawer__section">
              <div className="drawer__hint">Hard filters (must match exactly)</div>

              <div className="filter-pills-wrap">
                {(belief || music || politics) && (
                  <div className="filter-pills">
                    {belief && (
                      <span className="filter-pill">
                        Belief: {belief}
                        <button type="button" className="filter-pill-remove" onClick={() => setBelief("")} aria-label="Remove">×</button>
                      </span>
                    )}
                    {music && (
                      <span className="filter-pill">
                        Music: {music}
                        <button type="button" className="filter-pill-remove" onClick={() => setMusic("")} aria-label="Remove">×</button>
                      </span>
                    )}
                    {politics && (
                      <span className="filter-pill">
                        Politics: {politics}
                        <button type="button" className="filter-pill-remove" onClick={() => setPolitics("")} aria-label="Remove">×</button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {traitOptionsByCategory && (
                <>
                  <label className="field">
                    <span>Belief</span>
                    <select
                      className="drawer__select"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setBelief(v);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Select...</option>
                      {(traitOptionsByCategory.belief ?? []).map((o) => (
                        <option key={o.value} value={o.label}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Music</span>
                    <select
                      className="drawer__select"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setMusic(v);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Select...</option>
                      {(traitOptionsByCategory.music ?? []).map((o) => (
                        <option key={o.value} value={o.label}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Politics</span>
                    <select
                      className="drawer__select"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setPolitics(v);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Select...</option>
                      {(traitOptionsByCategory.politics ?? []).map((o) => (
                        <option key={o.value} value={o.label}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <div className="toggles">
                <button
                  className={`chip ${gym === true ? "chip--on" : ""}`}
                  onClick={() => setGym(gym === true ? null : true)}
                >
                  Gym (must be Yes)
                </button>
                <button
                  className={`chip ${gamer === true ? "chip--on" : ""}`}
                  onClick={() => setGamer(gamer === true ? null : true)}
                >
                  Gamer (must be Yes)
                </button>
              </div>
            </div>

            <div className="drawer__bottom">
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setOnlyNearby(true);
                  setMaxMiles(50);
                  setBelief("");
                  setMusic("");
                  setPolitics("");
                  setGym(null);
                  setGamer(null);
                }}
              >
                Reset
              </button>
              <button
                className="btn"
                onClick={() => {
                  setFilterOpen(false);
                  setPage(0);
                  load(0);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
