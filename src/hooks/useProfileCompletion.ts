import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

type ProfileCompletionState = {
  loading: boolean;
  complete: boolean;
};

const REQUIRED_CATEGORIES = ["belief", "music", "politics"] as const;

export function useProfileCompletion(userId: string | null | undefined): ProfileCompletionState {
  const location = useLocation();
  const [state, setState] = useState<ProfileCompletionState>({
    loading: !!userId,
    complete: false,
  });

  useEffect(() => {
    if (!userId) {
      setState({ loading: false, complete: false });
      return;
    }

    let cancelled = false;

    async function check() {
      setState((prev) => ({ ...prev, loading: true }));

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (profileError || !profile) {
        setState({ loading: false, complete: false });
        return;
      }

      const { data: traits, error: traitsError } = await supabase
        .from("profile_traits")
        .select("category")
        .eq("user_id", userId);

      if (cancelled) return;

      if (traitsError) {
        setState({ loading: false, complete: false });
        return;
      }

      const categories = new Set<string>();
      for (const row of traits ?? []) {
        const cat = (row as { category?: string }).category;
        if (cat) categories.add(cat);
      }

      const complete = REQUIRED_CATEGORIES.every((cat) => categories.has(cat));
      setState({ loading: false, complete });
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [userId, location.pathname]);

  return state;
}

