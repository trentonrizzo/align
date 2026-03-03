import { useEffect, useState } from "react";
import { fetchTraitOptionsGrouped, type TraitOptionByCategory } from "../lib/traitOptions";
import "./TraitPillSelect.css";

type TraitPillSelectProps = {
  userId: string;
  onSelectionChange?: (info: {
    byCategory: Record<string, { value: string; label: string } | null>;
  }) => void;
};

export function TraitPillSelect({ userId, onSelectionChange }: TraitPillSelectProps) {
  const [optionsByCategory, setOptionsByCategory] = useState<TraitOptionByCategory | null>(null);
  const [selectedByCategory, setSelectedByCategory] = useState<
    Record<string, { value: string; label: string } | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const opts: TraitOptionByCategory = await fetchTraitOptionsGrouped();
      setOptionsByCategory(opts);
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
    onSelectionChange({ byCategory: selectedByCategory });
  }, [selectedByCategory, onSelectionChange]);

  function selectForCategory(
    category: string,
    option: { value: string; label: string } | null
  ) {
    setSelectedByCategory((prev) => ({
      ...prev,
      [category]: option,
    }));
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
        const selected = selectedByCategory[category] ?? null;

        return (
          <div key={category} className="trait-pill-section">
            <label className="trait-pill-label">{categoryLabels[category]}</label>
            <div className="trait-pill-pills">
              {selected && (
                <span className="trait-pill-pill">
                  <span>{selected.label}</span>
                  <button
                    type="button"
                    className="trait-pill-remove"
                    onClick={() => selectForCategory(category, null)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <select
              className="trait-pill-dropdown"
              value={selected?.value ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  selectForCategory(category, null);
                  return;
                }
                const option = opts.find((o) => o.value === value) ?? null;
                selectForCategory(category, option);
              }}
            >
              <option value="">Select...</option>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
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

