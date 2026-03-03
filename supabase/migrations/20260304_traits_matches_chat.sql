-- =========================================
-- ALIGN: trait_options, profile_traits, matches, chat_threads, chat_messages
-- Safe to run multiple times (IF NOT EXISTS / DO blocks)
-- =========================================

-- 1) Trait options (grouped by category: belief, music, politics)
CREATE TABLE IF NOT EXISTS public.trait_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  UNIQUE (category, label)
);

CREATE INDEX IF NOT EXISTS trait_options_category_idx ON public.trait_options (category);

ALTER TABLE public.trait_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trait_options' AND policyname = 'trait_options: public read') THEN
    CREATE POLICY "trait_options: public read" ON public.trait_options FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 2) Profile traits (user's selected options; one row per trait)
CREATE TABLE IF NOT EXISTS public.profile_traits (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trait_option_id uuid NOT NULL REFERENCES public.trait_options (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trait_option_id)
);

CREATE INDEX IF NOT EXISTS profile_traits_user_idx ON public.profile_traits (user_id);

ALTER TABLE public.profile_traits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_traits' AND policyname = 'profile_traits: read own') THEN
    CREATE POLICY "profile_traits: read own" ON public.profile_traits FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_traits' AND policyname = 'profile_traits: insert own') THEN
    CREATE POLICY "profile_traits: insert own" ON public.profile_traits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_traits' AND policyname = 'profile_traits: delete own') THEN
    CREATE POLICY "profile_traits: delete own" ON public.profile_traits FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  -- Allow reading others' traits (for discover/compatibility)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profile_traits' AND policyname = 'profile_traits: read all') THEN
    CREATE POLICY "profile_traits: read all" ON public.profile_traits FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 3) Matches (mutual like; user_a < user_b for uniqueness)
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS matches_user_a_idx ON public.matches (user_a);
CREATE INDEX IF NOT EXISTS matches_user_b_idx ON public.matches (user_b);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches' AND policyname = 'matches: read own') THEN
    CREATE POLICY "matches: read own" ON public.matches FOR SELECT TO authenticated
      USING (auth.uid() = user_a OR auth.uid() = user_b);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches' AND policyname = 'matches: insert own') THEN
    CREATE POLICY "matches: insert own" ON public.matches FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
  END IF;
END $$;

-- 4) Chat threads (one per match)
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_threads_match_idx ON public.chat_threads (match_id);

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_threads' AND policyname = 'chat_threads: read participant') THEN
    CREATE POLICY "chat_threads: read participant" ON public.chat_threads FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = chat_threads.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_threads' AND policyname = 'chat_threads: insert participant') THEN
    CREATE POLICY "chat_threads: insert participant" ON public.chat_threads FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = chat_threads.match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
END $$;

-- 5) Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON public.chat_messages (thread_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON public.chat_messages (thread_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages: read participant') THEN
    CREATE POLICY "chat_messages: read participant" ON public.chat_messages FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_threads ct
          JOIN public.matches m ON m.id = ct.match_id
          WHERE ct.id = chat_messages.thread_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'chat_messages: insert sender') THEN
    CREATE POLICY "chat_messages: insert sender" ON public.chat_messages FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
          SELECT 1 FROM public.chat_threads ct
          JOIN public.matches m ON m.id = ct.match_id
          WHERE ct.id = chat_messages.thread_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
        )
      );
  END IF;
END $$;

-- 6) Seed trait_options (belief, music, politics)
INSERT INTO public.trait_options (category, label) VALUES
  ('belief', 'Atheist'),
  ('belief', 'Atheist/Agnostic'),
  ('belief', 'Agnostic'),
  ('belief', 'Non-religious'),
  ('belief', 'Christian'),
  ('belief', 'Muslim'),
  ('belief', 'Hindu'),
  ('belief', 'Buddhist'),
  ('belief', 'Jewish'),
  ('belief', 'Spiritual (not religious)'),
  ('belief', 'Other'),
  ('belief', 'Prefer not to say'),
  ('music', 'I don''t care'),
  ('music', 'Multi-genre'),
  ('music', 'Pop'),
  ('music', 'Hip-hop/Rap'),
  ('music', 'Rock'),
  ('music', 'Metal'),
  ('music', 'Deathcore/Death Metal'),
  ('music', 'Country'),
  ('music', 'EDM'),
  ('music', 'Jazz'),
  ('music', 'Classical'),
  ('music', 'Other'),
  ('music', 'Prefer not to say'),
  ('politics', 'Left / Liberal'),
  ('politics', 'Center / Moderate'),
  ('politics', 'Right / Conservative'),
  ('politics', 'Apolitical'),
  ('politics', 'Both suck'),
  ('politics', 'Other'),
  ('politics', 'Prefer not to say')
ON CONFLICT (category, label) DO NOTHING;

-- 7) Function: ensure match when both users have favorited each other (call from app after inserting favorite)
CREATE OR REPLACE FUNCTION public.ensure_match_on_mutual_favorite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_a uuid;
  u_b uuid;
BEGIN
  u_a := LEAST(NEW.user_id, NEW.target_user_id);
  u_b := GREATEST(NEW.user_id, NEW.target_user_id);
  IF u_a = u_b THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.matches (user_a, user_b)
  SELECT u_a, u_b
  WHERE EXISTS (
    SELECT 1 FROM public.profile_favorites f2
    WHERE f2.user_id = NEW.target_user_id AND f2.target_user_id = NEW.user_id
  )
  ON CONFLICT (user_a, user_b) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_match_on_favorite ON public.profile_favorites;
CREATE TRIGGER trigger_ensure_match_on_favorite
  AFTER INSERT ON public.profile_favorites
  FOR EACH ROW
  EXECUTE PROCEDURE public.ensure_match_on_mutual_favorite();

-- =========================================
-- END MIGRATION
-- =========================================
