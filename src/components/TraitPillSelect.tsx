import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  fetchTraitOptionsGrouped,
  fetchProfileTraits,
  type TraitOption,
  type TraitOptionByCategory,
  type ProfileTraitRow,
} from "../lib/traitOptions";
import "./TraitPillSelect.css";

type TraitPillSelectProps = {
  userId: string;
  onTraitsChange?: (traits: { belief: string; music: string; politics: string }) => void;
};

export function TraitPillSelect({ userId, onTraitsChange }: TraitPillSelectProps) {
  const [optionsByCategory, setOptionsByCategory] = useState<TraitOptionByCategory | null>(null);
  const [selected, setSelected] = useState<ProfileTraitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [opts, traits] = await Promise.all([
          fetchTraitOptionsGrouped(),
          fetchProfileTraits(userId),
        ]);
        if (!cancelled) {
          setOptionsByCategory(opts);
          setSelected(traits);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!onTraitsChange) return;
    const byCat: Record<string, string> = {};
    for (const row of selected) {
      const opt = row.trait_options ?? (row as unknown as { trait_options?: { category: string; label: string } }).trait_options;
      if (opt?.category && !(opt.category in byCat)) byCat[opt.category] = opt.label;
    }
    onTraitsChange({
      belief: byCat.belief ?? "",
      music: byCat.music ?? "",
      politics: byCat.politics ?? "",
    });
  }, [selected, onTraitsChange]);

  async function addTrait(traitOptionId: string) {
    const { error: err } = await supabase
      .from("profile_traits")
      .insert({ user_id: userId, trait_option_id: traitOptionId });

    if (err) {
      setError(err.message);
      return;
    }
    const opt = findOptionById(traitOptionId);
    if (opt) setSelected((prev) => [...prev, { user_id: userId, trait_option_id: traitOptionId, trait_options: opt }]);
  }

  async function removeTrait(traitOptionId: string) {
    const { error: err } = await supabase
      .from("profile_traits")
      .delete()
      .eq("user_id", userId)
      .eq("trait_option_id", traitOptionId);

    if (err) {
      setError(err.message);
      return;
    }
    setSelected((prev) => prev.filter((t) => t.trait_option_id !== traitOptionId));
  }

  function findOptionById(id: string): TraitOption | null {
    if (!optionsByCategory) return null;
    for (const opts of Object.values(optionsByCategory)) {
      const found = opts.find((o) => o.id === id);
      if (found) return found;
    }
    return null;
  }

  function getSelectedForCategory(category: string): ProfileTraitRow[] {
    return selected.filter((t) => {
      const opt = t.trait_options ?? (t as unknown as { trait_options?: { category: string } }).trait_options;
      return opt?.category === category;
    });
  }

  if (loading) return <p className="trait-pill-loading">Loading traits...</p>;
  if (error) return <p className="trait-pill-error">{error}</p>;
  if (!optionsByCategory) return null;

  const categories = ["belief", "music", "politics"] as const;
  const categoryLabels: Record<string, string> = {
    belief: "Belief / Religious affiliation",
    music: "Music preference",
    politics: "Politics",
  };

  return (
    <div className="trait-pill-select">
      {categories.map((category) => {
        const opts = optionsByCategory[category] ?? [];
        const selectedInCat = getSelectedForCategory(category);
        const alreadySelectedIds = new Set(selectedInCat.map((t) => t.trait_option_id));

        return (
          <div key={category} className="trait-pill-section">
            <label className="trait-pill-label">{categoryLabels[category]}</label>
            <div className="trait-pill-pills">
              {selectedInCat.map((t) => {
                const opt = t.trait_options ?? findOptionById(t.trait_option_id);
                const label = opt && "label" in opt ? opt.label : t.trait_option_id;
                return (
                  <span key={t.trait_option_id} className="trait-pill-pill">
                    <span>{label}</span>
                    <button
                      type="button"
                      className="trait-pill-remove"
                      onClick={() => removeTrait(t.trait_option_id)}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              className="trait-pill-dropdown"
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) addTrait(id);
                e.target.value = "";
              }}
            >
              <option value="">Add...</option>
              {opts
                .filter((o) => !alreadySelectedIds.has(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
