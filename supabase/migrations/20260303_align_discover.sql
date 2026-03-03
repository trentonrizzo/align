-- =========================================
-- ALIGN ME: Discover (nearby + compatibility) + filters + favorites
-- Safe to run multiple times (IF NOT EXISTS used where possible)
-- Adapted: profiles use music_pref; profile_photos uses existing (path, position).
-- =========================================

-- 0) Extensions (optional)
-- (No PostGIS required; we use haversine math.)
-- If you later want true geo indexes, enable PostGIS and convert to geography.

-- 1) Location fields on profiles (assumes public.profiles exists and id=auth.users.id)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters integer,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_lat_lng_idx ON public.profiles (latitude, longitude);

-- 2) Favorites (bookmark)
CREATE TABLE IF NOT EXISTS public.profile_favorites (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_user_id)
);

ALTER TABLE public.profile_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- User can read their own favorites
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_favorites' AND policyname='Favorites: read own'
  ) THEN
    CREATE POLICY "Favorites: read own"
      ON public.profile_favorites
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- User can create favorite for themselves
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_favorites' AND policyname='Favorites: insert own'
  ) THEN
    CREATE POLICY "Favorites: insert own"
      ON public.profile_favorites
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- User can delete their own favorite
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profile_favorites' AND policyname='Favorites: delete own'
  ) THEN
    CREATE POLICY "Favorites: delete own"
      ON public.profile_favorites
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Haversine distance (miles + km)
CREATE OR REPLACE FUNCTION public.haversine_miles(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    3958.7613 * 2 * asin(
      sqrt(
        power(sin(radians((lat2 - lat1) / 2)), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) *
        power(sin(radians((lon2 - lon1) / 2)), 2)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.haversine_miles(lat1, lon1, lat2, lon2) * 1.609344;
$$;

-- 4) Discover RPC
-- Uses existing profile_photos (path, position). Returns photos as [{ path, sort }];
-- frontend builds public URL from path via storage.
-- Filters (JSONB):
-- {
--   "maxMiles": 50,
--   "onlyNearby": true,
--   "belief": "Atheist",
--   "politics": "Left" | "Right" | "Both suck" | ...
--   "music_preference": "Metal",
--   "gym": true,
--   "gamer": true
-- }

CREATE OR REPLACE FUNCTION public.discover_profiles(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  user_id uuid,
  username text,
  age integer,
  bio text,
  gym boolean,
  gamer boolean,
  belief text,
  music_preference text,
  politics text,
  distance_miles double precision,
  compatibility integer,
  photos jsonb,
  is_favorited boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  me record;

  max_miles double precision := COALESCE((p_filters->>'maxMiles')::double precision, 50);
  only_nearby boolean := COALESCE((p_filters->>'onlyNearby')::boolean, true);

  f_belief text := NULLIF(p_filters->>'belief','');
  f_music text := NULLIF(p_filters->>'music_preference','');
  f_politics text := NULLIF(p_filters->>'politics','');

  f_gym boolean := CASE WHEN p_filters ? 'gym' THEN (p_filters->>'gym')::boolean ELSE NULL END;
  f_gamer boolean := CASE WHEN p_filters ? 'gamer' THEN (p_filters->>'gamer')::boolean ELSE NULL END;
BEGIN
  SELECT
    p.id,
    p.username,
    p.age,
    p.bio,
    p.gym,
    p.gamer,
    p.belief,
    p.music_pref,
    p.politics,
    p.latitude,
    p.longitude,
    p.location_hidden
  INTO me
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF me.id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.id AS cid,
      p.username,
      p.age,
      p.bio,
      p.gym,
      p.gamer,
      p.belief,
      p.music_pref AS music_preference,
      p.politics,
      p.latitude,
      p.longitude,
      p.location_hidden,

      CASE
        WHEN me.latitude IS NOT NULL AND me.longitude IS NOT NULL
         AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         AND me.location_hidden = false AND p.location_hidden = false
        THEN public.haversine_miles(me.latitude, me.longitude, p.latitude, p.longitude)
        ELSE NULL
      END AS dist_miles
    FROM public.profiles p
    WHERE p.id <> me.id
      AND (f_belief IS NULL OR p.belief = f_belief)
      AND (f_music  IS NULL OR p.music_pref = f_music)
      AND (f_politics IS NULL OR p.politics = f_politics)
      AND (f_gym IS NULL OR p.gym = f_gym)
      AND (f_gamer IS NULL OR p.gamer = f_gamer)
  ),
  nearby AS (
    SELECT *
    FROM candidates
    WHERE
      (
        only_nearby = false
        OR dist_miles IS NULL  -- if location missing, still allow unless you want strict nearby-only
        OR dist_miles <= max_miles
      )
  ),
  scored AS (
    SELECT
      n.*,
      -- Weighted compatibility (renormalizes if some fields are NULL)
      -- Weights: belief 30, politics 25, music 15, gym 15, gamer 15 (total 100)
      (
        CASE WHEN (me.belief IS NULL OR n.belief IS NULL) THEN 0 ELSE 30 END +
        CASE WHEN (me.politics IS NULL OR n.politics IS NULL) THEN 0 ELSE 25 END +
        CASE WHEN (me.music_pref IS NULL OR n.music_preference IS NULL) THEN 0 ELSE 15 END +
        CASE WHEN (me.gym IS NULL OR n.gym IS NULL) THEN 0 ELSE 15 END +
        CASE WHEN (me.gamer IS NULL OR n.gamer IS NULL) THEN 0 ELSE 15 END
      ) AS denom,
      (
        CASE WHEN (me.belief IS NOT NULL AND n.belief IS NOT NULL AND me.belief = n.belief) THEN 30 ELSE 0 END +
        CASE WHEN (me.politics IS NOT NULL AND n.politics IS NOT NULL AND me.politics = n.politics) THEN 25 ELSE 0 END +
        CASE WHEN (me.music_pref IS NOT NULL AND n.music_preference IS NOT NULL AND me.music_pref = n.music_preference) THEN 15 ELSE 0 END +
        CASE WHEN (me.gym IS NOT NULL AND n.gym IS NOT NULL AND me.gym = n.gym) THEN 15 ELSE 0 END +
        CASE WHEN (me.gamer IS NOT NULL AND n.gamer IS NOT NULL AND me.gamer = n.gamer) THEN 15 ELSE 0 END
      ) AS numer
    FROM nearby n
  )
  SELECT
    s.cid AS user_id,
    s.username,
    s.age,
    s.bio,
    s.gym,
    s.gamer,
    s.belief,
    s.music_preference,
    s.politics,
    s.dist_miles AS distance_miles,
    CASE
      WHEN s.denom = 0 THEN 50
      ELSE LEAST(100, GREATEST(0, round((s.numer::numeric / s.denom::numeric) * 100)::int))
    END AS compatibility,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('path', ph.path, 'sort', ph.position) ORDER BY ph.position NULLS LAST, ph.created_at)
        FROM public.profile_photos ph
        WHERE ph.user_id = s.cid
      ),
      '[]'::jsonb
    ) AS photos,
    EXISTS (
      SELECT 1
      FROM public.profile_favorites f
      WHERE f.user_id = me.id AND f.target_user_id = s.cid
    ) AS is_favorited
  FROM scored s
  ORDER BY
    -- prioritize with distance if available, then higher compatibility
    (s.dist_miles IS NULL) ASC,
    s.dist_miles ASC NULLS LAST,
    CASE
      WHEN s.denom = 0 THEN 50
      ELSE round((s.numer::numeric / s.denom::numeric) * 100)::int
    END DESC,
    s.username ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.discover_profiles(uuid, integer, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_profiles(uuid, integer, integer, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.haversine_miles(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.haversine_miles(double precision, double precision, double precision, double precision) TO authenticated;

REVOKE ALL ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) TO authenticated;

-- =========================================
-- END MIGRATION
-- =========================================
