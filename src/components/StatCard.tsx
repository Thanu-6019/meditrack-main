interface StatCardProps {
  icon: string;
  iconBg: string;
  value: string | number;
  label: string;
  trend?: string;
  trendDir?: "good" | "warn" | "bad" | "neutral";
  unit?: string;
  onClick?: () => void;
}

export default function StatCard({
  icon,
  iconBg,
  value,
  label,
  trend,
  trendDir = "neutral",
  unit,
  onClick,
}: StatCardProps) {
  const trendClass =
    trendDir === "good"
      ? "trend-good"
      : trendDir === "warn"
      ? "trend-warn"
      : trendDir === "bad"
      ? "trend-bad"
      : "trend-neutral";

  const trendArrow =
    trendDir === "good" ? "↑ " : trendDir === "bad" ? "↓ " : "● ";

  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          className="stat-icon"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        {unit && <span className="badge badge-slate">{unit}</span>}
      </div>
      <div>
        <div className="stat-val">{value}</div>
        <div className="stat-lbl">{label}</div>
      </div>
      {trend && (
        <div className={`stat-trend ${trendClass}`}>
          {trendArrow}
          {trend}
        </div>
      )}
    </div>
  );
}