interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "32px 24px" : "64px 24px",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: compact ? 52 : 68,
          height: compact ? 52 : 68,
          borderRadius: compact ? 14 : 18,
          background: "var(--n-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: compact ? 24 : 32,
          marginBottom: 4,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: compact ? 17 : 20,
          color: "var(--n-800)",
          letterSpacing: "-.01em",
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 13.5,
          color: "var(--muted)",
          lineHeight: 1.6,
          maxWidth: 320,
          margin: 0,
        }}
      >
        {description}
      </p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}