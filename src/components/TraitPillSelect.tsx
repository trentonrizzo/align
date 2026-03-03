import { useEffect, useState } from "react";
import {
  fetchTraitOptionsGrouped,
  fetchProfileTraits,
  type TraitOption,
  type TraitOptionByCategory,
  type ProfileTraitRow,
} from "../lib/traitOptions";
import "./TraitPillSelect.css";

type TraitSelectionInfo = {
  selectedIds: string[];
  byCategory: Record<string, string[]>;
};

type TraitPillSelectProps = {
  userId: string;
  onSelectionChange?: (info: TraitSelectionInfo) => void;
};

export function TraitPillSelect({ userId, onSelectionChange }: TraitPillSelectProps) {
  const [optionsByCategory, setOptionsByCategory] = useState<TraitOptionByCategory | null>(null);
  const [selected, setSelected] = useState<ProfileTraitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [opts, traits] = await Promise.all([
        fetchTraitOptionsGrouped(),
        fetchProfileTraits(userId),
      ]);
      setOptionsByCategory(opts);
      setSelected(traits);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Could not load alignment traits: ${e.message}`
          : "Could not load alignment traits."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await load();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const byCategory: Record<string, string[]> = {};
    const selectedIds: string[] = [];

    for (const row of selected) {
      const opt =
        row.trait_options ??
        (row as unknown as { trait_options?: { category: string; label: string } }).trait_options;
      if (!opt?.category) continue;
      selectedIds.push(row.trait_option_id);
      if (!byCategory[opt.category]) byCategory[opt.category] = [];
      byCategory[opt.category].push(opt.label);
    }

    onSelectionChange({ selectedIds, byCategory });
  }, [selected, onSelectionChange]);

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
      const opt =
        t.trait_options ??
        (t as unknown as { trait_options?: { category: string } }).trait_options;
      return opt?.category === category;
    });
  }

  function toggleTrait(traitOptionId: string, category: string) {
    setSelected((prev) => {
      const exists = prev.some((t) => t.trait_option_id === traitOptionId);
      if (exists) {
        return prev.filter((t) => t.trait_option_id !== traitOptionId);
      }
      const opt = findOptionById(traitOptionId);
      if (!opt) return prev;
      // single-select per category: remove others in same category
      const withoutCategory = prev.filter((t) => {
        const o =
          t.trait_options ??
          (t as unknown as { trait_options?: { category: string } }).trait_options;
        return o?.category !== category;
      });
      return [
        ...withoutCategory,
        { user_id: userId, trait_option_id: traitOptionId, trait_options: opt },
      ];
    });
  }

  if (loading) {
    return (
      <div className="trait-pill-loading">
        <div className="trait-pill-skeleton-row" />
        <div className="trait-pill-skeleton-row" />
        <div className="trait-pill-skeleton-row" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="trait-pill-error">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!optionsByCategory) {
    return (
      <div className="trait-pill-error">
        <p>No alignment traits are configured yet.</p>
      </div>
    );
  }

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
        const selectedIdInCat = selectedInCat[0]?.trait_option_id ?? null;

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
                      onClick={() => toggleTrait(t.trait_option_id, category)}
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
              value={selectedIdInCat ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) toggleTrait(id, category);
              }}
            >
              <option value="">Select...</option>
              {opts.map((o) => (
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

