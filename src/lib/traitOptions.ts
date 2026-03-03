import { supabase } from "./supabase";

export type TraitOption = {
  id: string;
  category: string;
  label: string;
};

export type TraitOptionByCategory = Record<string, TraitOption[]>;

export async function fetchTraitOptionsGrouped(): Promise<TraitOptionByCategory> {
  const { data, error } = await supabase
    .from("trait_options")
    .select("id, category, label")
    .order("category")
    .order("label");

  if (error) throw error;

  const byCategory: TraitOptionByCategory = {};
  for (const row of data ?? []) {
    const cat = row.category as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({
      id: row.id,
      category: cat,
      label: row.label as string,
    });
  }
  return byCategory;
}

export type ProfileTraitRow = {
  user_id: string;
  trait_option_id: string;
  trait_options?: { id: string; category: string; label: string } | null;
};

export async function fetchProfileTraits(userId: string): Promise<ProfileTraitRow[]> {
  const { data, error } = await supabase
    .from("profile_traits")
    .select("user_id, trait_option_id, trait_options(id, category, label)")
    .eq("user_id", userId);

  if (error) throw error;
  const rows: ProfileTraitRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const opts = row.trait_options;
    const single = Array.isArray(opts) ? opts[0] : opts;
    return {
      user_id: row.user_id as string,
      trait_option_id: row.trait_option_id as string,
      trait_options: single ? { id: (single as { id: string }).id, category: (single as { category: string }).category, label: (single as { label: string }).label } : null,
    };
  });
  return rows;
}
