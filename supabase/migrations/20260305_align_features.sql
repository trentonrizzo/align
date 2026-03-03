-- =========================================
-- ALIGN: Additional tables for full feature set
-- Creates tables only if they don't exist (no modifications to existing)
-- =========================================

-- 1) align_requests (Align button on discover)
CREATE TABLE IF NOT EXISTS public.align_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS align_requests_from_idx ON public.align_requests (from_user_id);
CREATE INDEX IF NOT EXISTS align_requests_to_idx ON public.align_requests (to_user_id);

ALTER TABLE public.align_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'align_requests' AND policyname = 'align_requests: read own') THEN
    CREATE POLICY "align_requests: read own" ON public.align_requests FOR SELECT TO authenticated
      USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'align_requests' AND policyname = 'align_requests: insert own') THEN
    CREATE POLICY "align_requests: insert own" ON public.align_requests FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = from_user_id);
  END IF;
END $$;

-- 2) favorites (alias for profile_favorites - same structure)
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_user_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorites' AND policyname = 'favorites: read own') THEN
    CREATE POLICY "favorites: read own" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorites' AND policyname = 'favorites: insert own') THEN
    CREATE POLICY "favorites: insert own" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorites' AND policyname = 'favorites: delete own') THEN
    CREATE POLICY "favorites: delete own" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3) user_blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_blocks' AND policyname = 'user_blocks: read own') THEN
    CREATE POLICY "user_blocks: read own" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_blocks' AND policyname = 'user_blocks: insert own') THEN
    CREATE POLICY "user_blocks: insert own" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_blocks' AND policyname = 'user_blocks: delete own') THEN
    CREATE POLICY "user_blocks: delete own" ON public.user_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);
  END IF;
END $$;

-- 4) hidden_profiles
CREATE TABLE IF NOT EXISTS public.hidden_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS hidden_profiles_user_idx ON public.hidden_profiles (user_id);

ALTER TABLE public.hidden_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hidden_profiles' AND policyname = 'hidden_profiles: read own') THEN
    CREATE POLICY "hidden_profiles: read own" ON public.hidden_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hidden_profiles' AND policyname = 'hidden_profiles: insert own') THEN
    CREATE POLICY "hidden_profiles: insert own" ON public.hidden_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hidden_profiles' AND policyname = 'hidden_profiles: delete own') THEN
    CREATE POLICY "hidden_profiles: delete own" ON public.hidden_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5) user_reports
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_reports_reporter_idx ON public.user_reports (reporter_id);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reports' AND policyname = 'user_reports: insert own') THEN
    CREATE POLICY "user_reports: insert own" ON public.user_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

-- 5b) profile_traits_view (for traitOptions - joins profile_traits with trait_options)
CREATE OR REPLACE VIEW public.profile_traits_view AS
SELECT pt.user_id, to_.category, to_.label AS value, to_.label
FROM public.profile_traits pt
JOIN public.trait_options to_ ON to_.id = pt.trait_option_id;

-- 6) profile_images (up to 10 images: user_id, url, position)
CREATE TABLE IF NOT EXISTS public.profile_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_images_user_idx ON public.profile_images (user_id);

ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_images' AND policyname = 'profile_images: read all') THEN
    CREATE POLICY "profile_images: read all" ON public.profile_images FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_images' AND policyname = 'profile_images: insert own') THEN
    CREATE POLICY "profile_images: insert own" ON public.profile_images FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_images' AND policyname = 'profile_images: update own') THEN
    CREATE POLICY "profile_images: update own" ON public.profile_images FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_images' AND policyname = 'profile_images: delete own') THEN
    CREATE POLICY "profile_images: delete own" ON public.profile_images FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 7) chats (one per match; maps to chat_threads concept)
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chats_match_idx ON public.chats (match_id);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'chats: read participant') THEN
    CREATE POLICY "chats: read participant" ON public.chats FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = chats.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'chats: insert participant') THEN
    CREATE POLICY "chats: insert participant" ON public.chats FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = chats.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
END $$;

-- 8) messages (chat_id, sender_id, body, read_at)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_chat_idx ON public.messages (chat_id);
CREATE INDEX IF NOT EXISTS messages_created_idx ON public.messages (chat_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages: read participant') THEN
    CREATE POLICY "messages: read participant" ON public.messages FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.chats c
          JOIN public.matches m ON m.id = c.match_id
          WHERE c.id = messages.chat_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages: insert sender') THEN
    CREATE POLICY "messages: insert sender" ON public.messages FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
          SELECT 1 FROM public.chats c
          JOIN public.matches m ON m.id = c.match_id
          WHERE c.id = messages.chat_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages: update read_at') THEN
    CREATE POLICY "messages: update read_at" ON public.messages FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.chats c
          JOIN public.matches m ON m.id = c.match_id
          WHERE c.id = messages.chat_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
END $$;

-- 9) notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text,
  body text,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id, is_read) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications: read own') THEN
    CREATE POLICY "notifications: read own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications: update own') THEN
    CREATE POLICY "notifications: update own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- 10) notification_mutes
CREATE TABLE IF NOT EXISTS public.notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mute_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mute_type)
);

CREATE INDEX IF NOT EXISTS notification_mutes_user_idx ON public.notification_mutes (user_id);

ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_mutes' AND policyname = 'notification_mutes: read own') THEN
    CREATE POLICY "notification_mutes: read own" ON public.notification_mutes FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_mutes' AND policyname = 'notification_mutes: insert own') THEN
    CREATE POLICY "notification_mutes: insert own" ON public.notification_mutes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_mutes' AND policyname = 'notification_mutes: delete own') THEN
    CREATE POLICY "notification_mutes: delete own" ON public.notification_mutes FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger: create match on align_requests when both users have aligned
CREATE OR REPLACE FUNCTION public.ensure_match_on_align()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_a uuid;
  u_b uuid;
BEGIN
  u_a := LEAST(NEW.from_user_id, NEW.to_user_id);
  u_b := GREATEST(NEW.from_user_id, NEW.to_user_id);
  IF u_a = u_b THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.matches (user_a, user_b)
  SELECT u_a, u_b
  WHERE EXISTS (
    SELECT 1 FROM public.align_requests ar
    WHERE ar.from_user_id = NEW.to_user_id AND ar.to_user_id = NEW.from_user_id AND ar.status = 'pending'
  )
  ON CONFLICT (user_a, user_b) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_match_on_align ON public.align_requests;
CREATE TRIGGER trigger_ensure_match_on_align
  AFTER INSERT ON public.align_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.ensure_match_on_align();

-- Update discover_profiles to check favorites (and profile_favorites for backward compat)
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
  SELECT p.id, p.username, p.age, p.bio, p.gym, p.gamer, p.belief, p.music_pref, p.politics, p.latitude, p.longitude, p.location_hidden
  INTO me FROM public.profiles p WHERE p.id = p_user_id;
  IF me.id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH blocked AS (
    SELECT blocked_id AS bid FROM public.user_blocks WHERE blocker_id = me.id
    UNION
    SELECT blocker_id AS bid FROM public.user_blocks WHERE blocked_id = me.id
  ),
  hidden AS (
    SELECT target_user_id AS hid FROM public.hidden_profiles WHERE user_id = me.id
  ),
  candidates AS (
    SELECT p.id AS cid, p.username, p.age, p.bio, p.gym, p.gamer, p.belief, p.music_pref AS music_preference, p.politics, p.latitude, p.longitude, p.location_hidden,
      CASE WHEN me.latitude IS NOT NULL AND me.longitude IS NOT NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND me.location_hidden = false AND p.location_hidden = false
        THEN public.haversine_miles(me.latitude, me.longitude, p.latitude, p.longitude) ELSE NULL END AS dist_miles
    FROM public.profiles p
    WHERE p.id <> me.id
      AND p.id NOT IN (SELECT bid FROM blocked)
      AND p.id NOT IN (SELECT hid FROM hidden)
      AND (f_belief IS NULL OR p.belief = f_belief)
      AND (f_music IS NULL OR p.music_pref = f_music)
      AND (f_politics IS NULL OR p.politics = f_politics)
      AND (f_gym IS NULL OR p.gym = f_gym)
      AND (f_gamer IS NULL OR p.gamer = f_gamer)
  ),
  nearby AS (
    SELECT * FROM candidates
    WHERE only_nearby = false OR dist_miles IS NULL OR dist_miles <= max_miles
  ),
  scored AS (
    SELECT n.*,
      (CASE WHEN (me.belief IS NULL OR n.belief IS NULL) THEN 0 ELSE 30 END + CASE WHEN (me.politics IS NULL OR n.politics IS NULL) THEN 0 ELSE 25 END + CASE WHEN (me.music_pref IS NULL OR n.music_preference IS NULL) THEN 0 ELSE 15 END + CASE WHEN (me.gym IS NULL OR n.gym IS NULL) THEN 0 ELSE 15 END + CASE WHEN (me.gamer IS NULL OR n.gamer IS NULL) THEN 0 ELSE 15 END) AS denom,
      (CASE WHEN (me.belief IS NOT NULL AND n.belief IS NOT NULL AND me.belief = n.belief) THEN 30 ELSE 0 END + CASE WHEN (me.politics IS NOT NULL AND n.politics IS NOT NULL AND me.politics = n.politics) THEN 25 ELSE 0 END + CASE WHEN (me.music_pref IS NOT NULL AND n.music_preference IS NOT NULL AND me.music_pref = n.music_preference) THEN 15 ELSE 0 END + CASE WHEN (me.gym IS NOT NULL AND n.gym IS NOT NULL AND me.gym = n.gym) THEN 15 ELSE 0 END + CASE WHEN (me.gamer IS NOT NULL AND n.gamer IS NOT NULL AND me.gamer = n.gamer) THEN 15 ELSE 0 END AS numer
    FROM nearby n
  )
  SELECT s.cid AS user_id, s.username, s.age, s.bio, s.gym, s.gamer, s.belief, s.music_preference, s.politics, s.dist_miles AS distance_miles,
    CASE WHEN s.denom = 0 THEN 50 ELSE LEAST(100, GREATEST(0, round((s.numer::numeric / s.denom::numeric) * 100)::int)) END AS compatibility,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('path', ph.path, 'sort', ph.position) ORDER BY ph.position NULLS LAST, ph.created_at) FROM public.profile_photos ph WHERE ph.user_id = s.cid), '[]'::jsonb) AS photos,
    (EXISTS (SELECT 1 FROM public.favorites f WHERE f.user_id = me.id AND f.target_user_id = s.cid) OR EXISTS (SELECT 1 FROM public.profile_favorites f WHERE f.user_id = me.id AND f.target_user_id = s.cid)) AS is_favorited
  FROM scored s
  ORDER BY (s.dist_miles IS NULL) ASC, s.dist_miles ASC NULLS LAST, CASE WHEN s.denom = 0 THEN 50 ELSE round((s.numer::numeric / s.denom::numeric) * 100)::int END DESC, s.username ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =========================================
-- END MIGRATION
-- =========================================
