interface Tab<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export default function FilterTabs<T extends string>({
  tabs,
  active,
  onChange,
}: FilterTabsProps<T>) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`btn btn-sm ${active === tab.key ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onChange(tab.key)}
          style={{ gap: 7 }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: "99px",
                background:
                  active === tab.key
                    ? "rgba(255,255,255,.25)"
                    : "var(--n-200)",
                color:
                  active === tab.key ? "white" : "var(--n-600)",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 5px",
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}