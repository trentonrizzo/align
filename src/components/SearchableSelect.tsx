import { useMemo, useState } from "react";

export type Option = {
  label: string;
  value: string;
};

type SearchableSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  pinnedValues?: string[];
  required?: boolean;
  error?: string | null;
};

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  pinnedValues = [],
  required,
  error,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const orderedOptions = useMemo(() => {
    const pinned: Option[] = [];
    const rest: Option[] = [];

    const map = new Map(options.map((o) => [o.value, o]));

    for (const v of pinnedValues) {
      const opt = map.get(v);
      if (opt) {
        pinned.push(opt);
      }
    }

    const pinnedSet = new Set(pinnedValues);

    for (const opt of options) {
      if (!pinnedSet.has(opt.value)) {
        rest.push(opt);
      }
    }

    rest.sort((a, b) => a.label.localeCompare(b.label));

    return [...pinned, ...rest];
  }, [options, pinnedValues]);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orderedOptions;
    return orderedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(term)
    );
  }, [orderedOptions, search]);

  function handleSelect(option: Option) {
    onChange(option.value);
    setOpen(false);
  }

  const selected = options.find((o) => o.value === value);

  return (
    <div style={{ display: "grid", gap: "0.25rem" }}>
      <span>
        {label}
        {required && " *"}
      </span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          padding: "0.5rem",
          border: "1px solid #ccc",
          background: "#fff",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <span style={{ color: selected ? "#111" : "#888" }}>
          {selected ? selected.label : "Select..."}
        </span>
        <span aria-hidden="true" style={{ marginLeft: "0.5rem" }}>
          ▼
        </span>
      </button>
      {error && (
        <span style={{ color: "red", fontSize: "0.8rem" }}>{error}</span>
      )}
      {open && (
        <div
          style={{
            marginTop: "0.25rem",
            border: "1px solid #ccc",
            background: "#fff",
            maxHeight: 200,
            overflow: "auto",
            padding: "0.5rem",
            position: "relative",
            zIndex: 400,
          }}
        >
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #ddd",
              marginBottom: "0.5rem",
            }}
          />
          {filteredOptions.length === 0 && (
            <div style={{ fontSize: "0.85rem", color: "#666" }}>No results</div>
          )}
          {filteredOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.25rem 0.3rem",
                border: "none",
                background:
                  opt.value === value ? "rgba(0,0,0,0.06)" : "transparent",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

