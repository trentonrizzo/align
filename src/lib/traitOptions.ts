import { supabase } from "./supabase";

export type TraitOption = {
  value: string;
  label: string;
};

export type TraitOptionByCategory = Record<string, TraitOption[]>;

export async function fetchTraitOptionsGrouped(): Promise<TraitOptionByCategory> {
  const { data, error } = await supabase
    .from("trait_options")
    .select("category, label")
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw error;

  const byCategory: TraitOptionByCategory = {};
  for (const row of data ?? []) {
    const cat = row.category as string;
    const label = row.label as string;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({
      value: label,
      label,
    });
  }
  return byCategory;
}

export type ProfileTraitSelection = {
  category: string;
  value: string;
  label: string;
};

export type ProfileTraitsResult = {
  byCategory: Record<string, { value: string; label: string }>;
  selected: ProfileTraitSelection[];
};

export async function fetchProfileTraits(userId: string): Promise<ProfileTraitsResult> {
  const { data, error } = await supabase
    .from("profile_traits_view")
    .select("category, value, label")
    .eq("user_id", userId);

  if (error) throw error;

  const byCategory: Record<string, { value: string; label: string }> = {};
  const selected: ProfileTraitSelection[] = [];

  for (const row of data ?? []) {
    const cat = row.category as string;
    const value = row.value as string;
    const label = row.label as string;
    selected.push({ category: cat, value, label });
    if (!byCategory[cat]) {
      byCategory[cat] = { value, label };
    }
  }

  return { byCategory, selected };
}

