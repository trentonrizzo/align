import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { fetchProfileTraits } from "../lib/traitOptions";
import "./ProfileViewerPage.css";

type ProfileData = {
  username: string | null;
  age: number | null;
  bio: string | null;
  belief: string | null;
  music_pref: string | null;
  politics: string | null;
  gym: boolean | null;
  gamer: boolean | null;
};

type ImageItem = { id: string; url?: string; path?: string; position: number };

function computeCompatibility(
  me: { belief?: string; music_pref?: string; politics?: string; gym?: boolean; gamer?: boolean },
  other: ProfileData
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

function getPhotoUrl(item: ImageItem): string | null {
  if (item.url) return item.url;
  if (item.path) {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(item.path);
    return data.publicUrl;
  }
  return null;
}

export default function ProfileViewerPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [traits, setTraits] = useState<string[]>([]);
  const [compatibility, setCompatibility] = useState(50);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const loadProfile = useCallback(async () => {
    if (!user || !userId) return;

    setLoading(true);
    setError(null);

    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("username, age, bio, belief, music_pref, politics, gym, gamer")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profileData) {
      setError("Profile not found");
      setLoading(false);
      return;
    }

    setProfile(profileData as ProfileData);

    const imgList: ImageItem[] = [];
    const { data: profileImages } = await supabase
      .from("profile_images")
      .select("id, url, position")
      .eq("user_id", userId)
      .order("position", { ascending: true });

    if (profileImages?.length) {
      profileImages.forEach((r: { id: string; url: string; position: number }) =>
        imgList.push({ id: r.id, url: r.url, position: r.position })
      );
    } else {
      const { data: profilePhotos } = await supabase
        .from("profile_photos")
        .select("id, path, position")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      profilePhotos?.forEach((r: { id: string; path: string; position: number }) =>
        imgList.push({ id: r.id, path: r.path, position: r.position ?? 0 })
      );
    }
    setImages(imgList);

    const traitLabels: string[] = [];
    try {
      const { byCategory } = await fetchProfileTraits(userId);
      Object.values(byCategory).forEach((v) => v && traitLabels.push(v.label));
    } catch {
      if (profileData.belief) traitLabels.push(profileData.belief);
      if (profileData.music_pref) traitLabels.push(profileData.music_pref);
      if (profileData.politics) traitLabels.push(profileData.politics);
    }
    if (profileData.gym) traitLabels.push("Gym");
    if (profileData.gamer) traitLabels.push("Gamer");
    setTraits(traitLabels);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("belief, music_pref, politics, gym, gamer")
      .eq("id", user.id)
      .maybeSingle();
    setCompatibility(
      myProfile ? computeCompatibility(myProfile, profileData as ProfileData) : 50
    );

    const { data: fav } = await supabase
      .from("favorites")
      .select("target_user_id")
      .eq("user_id", user.id)
      .eq("target_user_id", userId)
      .maybeSingle();
    if (!fav) {
      const { data: pf } = await supabase
        .from("profile_favorites")
        .select("target_user_id")
        .eq("user_id", user.id)
        .eq("target_user_id", userId)
        .maybeSingle();
      setIsFavorited(!!pf);
    } else {
      setIsFavorited(true);
    }

    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .or(`and(user_a.eq.${user.id},user_b.eq.${userId}),and(user_a.eq.${userId},user_b.eq.${user.id})`)
      .maybeSingle();
    setIsMatched(!!match);
    setMatchId(match?.id ?? null);

    setLoading(false);
  }, [user, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleAlign() {
    if (!user || !userId) return;
    const { error } = await supabase.from("align_requests").insert({
      from_user_id: user.id,
      to_user_id: userId,
      status: "pending",
    });
    if (!error) navigate("/discover");
  }

  async function handleFavorite() {
    if (!user || !userId) return;
    if (isFavorited) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("target_user_id", userId);
      await supabase.from("profile_favorites").delete().eq("user_id", user.id).eq("target_user_id", userId);
      setIsFavorited(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, target_user_id: userId });
      await supabase.from("profile_favorites").insert({ user_id: user.id, target_user_id: userId });
      setIsFavorited(true);
    }
  }

  function handleMessage() {
    if (matchId) navigate(`/aligned/chat/${matchId}`);
  }

  async function handleBlock() {
    if (!user || !userId) return;
    await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: userId });
    navigate("/discover");
  }

  async function handleHide() {
    if (!user || !userId) return;
    await supabase.from("hidden_profiles").insert({ user_id: user.id, target_user_id: userId });
    navigate("/discover");
  }

  async function handleReport() {
    if (!user || !userId || !reportReason.trim()) return;
    await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: userId,
      reason: reportReason.trim(),
      details: reportDetails.trim() || null,
    });
    setReportOpen(false);
    setReportReason("");
    setReportDetails("");
    navigate("/discover");
  }

  if (!user) {
    return (
      <div className="profile-viewer-page">
        <div className="profile-viewer-placeholder">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-viewer-page">
        <div className="profile-viewer-placeholder">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-viewer-page">
        <header className="profile-viewer-header">
          <button type="button" className="profile-viewer-back" onClick={() => navigate(-1)}>
            Back
          </button>
        </header>
        <div className="profile-viewer-error">{error ?? "Profile not found"}</div>
      </div>
    );
  }

  const firstImage = images[0];
  const firstUrl = firstImage ? getPhotoUrl(firstImage) : null;

  return (
    <div className="profile-viewer-page">
      <header className="profile-viewer-header">
        <button type="button" className="profile-viewer-back" onClick={() => navigate(-1)}>
          Back
        </button>
        <h1 className="profile-viewer-title">Profile</h1>
      </header>

      <div className="profile-viewer-gallery" onClick={() => images.length > 0 && setGalleryOpen(true)}>
        {firstUrl ? (
          <img src={firstUrl} alt={profile.username ?? "Profile"} />
        ) : (
          <div className="profile-viewer-placeholder-img" />
        )}
        <div className="profile-viewer-badge">{compatibility}% aligned</div>
      </div>

      <div className="profile-viewer-body">
        <h2 className="profile-viewer-name">
          {profile.username ?? "Unknown"}
          {profile.age != null ? <span className="profile-viewer-age"> {profile.age}</span> : null}
        </h2>

        <div className="profile-viewer-traits">
          {traits.map((t) => (
            <span key={t} className="profile-viewer-pill">
              {t}
            </span>
          ))}
        </div>

        <p className="profile-viewer-bio">{profile.bio || "No bio yet."}</p>

        <div className="profile-viewer-actions">
          <button type="button" className="btn btn--primary" onClick={handleAlign}>
            Align
          </button>
          <button type="button" className="btn btn--ghost" onClick={handleFavorite}>
            {isFavorited ? "Favorited" : "Favorite"}
          </button>
          {isMatched && matchId && (
            <button type="button" className="btn btn--primary" onClick={handleMessage}>
              Message
            </button>
          )}
        </div>

        <div className="profile-viewer-safety">
          <button type="button" className="btn btn--ghost btn--danger" onClick={handleHide}>
            Hide profile
          </button>
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => setReportOpen(true)}>
            Report
          </button>
          <button type="button" className="btn btn--ghost btn--danger" onClick={handleBlock}>
            Block user
          </button>
        </div>
      </div>

      {reportOpen && (
        <div className="profile-viewer-modal" onClick={() => setReportOpen(false)}>
          <div className="profile-viewer-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Report user</h3>
            <label>
              Reason
              <input
                type="text"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g. spam, harassment"
              />
            </label>
            <label>
              Details (optional)
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
              />
            </label>
            <div className="profile-viewer-modal-actions">
              <button type="button" onClick={() => setReportOpen(false)}>Cancel</button>
              <button type="button" onClick={handleReport} disabled={!reportReason.trim()}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {galleryOpen && images.length > 0 && (
        <div className="profile-viewer-gallery-modal" onClick={() => setGalleryOpen(false)}>
          <button
            type="button"
            className="profile-viewer-gallery-close"
            onClick={() => setGalleryOpen(false)}
            aria-label="Close"
          >
            x
          </button>
          <div className="profile-viewer-gallery-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={getPhotoUrl(images[galleryIndex]) ?? ""}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" }}
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="profile-viewer-gallery-nav profile-viewer-gallery-prev"
                  onClick={() => setGalleryIndex((i) => (i - 1 + images.length) % images.length)}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="profile-viewer-gallery-nav profile-viewer-gallery-next"
                  onClick={() => setGalleryIndex((i) => (i + 1) % images.length)}
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
