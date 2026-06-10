"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";

interface MetricReading {
  id: string;
  timestamp: string;
  type: string;
  value: number | null;
  systolic: number | null;
  diastolic: number | null;
  displayValue: string;
  status: string;
  notes: string | null;
  unit: string | null;
  tags?: string[];
  source?: string;
  customLabel?: string | null;
}

const METRIC_CONFIG: Record<string, { label: string; icon: string; iconBg: string; iconColor: string; ref: string; min: number; max: number }> = {
  heart_rate: { label: "Heart Rate", icon: "♥", iconBg: "#fff1f2", iconColor: "#e11d48", ref: "60–100 bpm", min: 60, max: 100 },
  blood_pressure: { label: "Blood Pressure", icon: "🩺", iconBg: "#f0fdf4", iconColor: "#16a34a", ref: "<120/80 mmHg", min: 60, max: 120 },
  glucose: { label: "Blood Glucose", icon: "🩸", iconBg: "#fffbeb", iconColor: "#d97706", ref: "70–99 mg/dL", min: 70, max: 99 },
  oxygen_saturation: { label: "Oxygen Saturation", icon: "💨", iconBg: "#eff6ff", iconColor: "#2563eb", ref: "95–100%", min: 95, max: 100 },
  weight: { label: "Weight", icon: "⚖", iconBg: "#f5f3ff", iconColor: "#7c3aed", ref: "60–90 kg", min: 0, max: 1000 },
  cholesterol: { label: "Cholesterol", icon: "🧬", iconBg: "#fff7ed", iconColor: "#ea580c", ref: "<200 mg/dL", min: 0, max: 200 },
  bmi: { label: "BMI", icon: "📐", iconBg: "#f0fdf4", iconColor: "#16a34a", ref: "18.5–24.9", min: 18.5, max: 24.9 },
  temperature: { label: "Temperature", icon: "🌡️", iconBg: "#fff1f2", iconColor: "#e11d48", ref: "36.1–37.2 °C", min: 36.1, max: 37.2 },
  sleep: { label: "Sleep", icon: "🌙", iconBg: "#f5f3ff", iconColor: "#7c3aed", ref: "7–9 hours", min: 7, max: 9 },
  custom: { label: "Custom Metric", icon: "📊", iconBg: "#f3f4f6", iconColor: "#4b5563", ref: "--", min: 0, max: 9999 }
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return <div style={{ height: 32, fontSize: 11, color: "var(--muted)" }}>No history</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
        r="3"
        fill={color}
      />
    </svg>
  );
}

export default function HealthMetricsPage() {
  const [metrics, setMetrics] = useState<MetricReading[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRange, setActiveRange] = useState("7D");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [formType, setFormType] = useState("heart_rate");
  const [formValue, setFormValue] = useState("");
  const [formSystolic, setFormSystolic] = useState("");
  const [formDiastolic, setFormDiastolic] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formTimestamp, setFormTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [formNotes, setFormNotes] = useState("");
  const [formCustomLabel, setFormCustomLabel] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch User details
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (userData.success) {
        setUser(userData.data.user);
      }

      // 2. Fetch health metrics sorted descending (newest first)
      const metricsRes = await fetch("/api/health-metrics?sort=desc&limit=100");
      const metricsData = await metricsRes.json();
      if (metricsData.success) {
        setMetrics(metricsData.data.metrics || []);
      } else {
        setError(metricsData.error?.message || "Failed to load metrics");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while fetching health data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync default unit when type changes
  useEffect(() => {
    const defaults: Record<string, string> = {
      weight: "kg",
      blood_pressure: "mmHg",
      glucose: "mg/dL",
      heart_rate: "bpm",
      oxygen_saturation: "%",
      temperature: "°C",
      cholesterol: "mg/dL",
      bmi: "kg/m²",
      sleep: "hours"
    };
    setFormUnit(defaults[formType] || "");
  }, [formType]);

  const handleLogReading = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const body: any = {
      type: formType,
      timestamp: formTimestamp ? new Date(formTimestamp).toISOString() : new Date().toISOString(),
      notes: formNotes.trim() || null,
      unit: formUnit.trim() || null,
      source: "manual"
    };

    if (formType === "blood_pressure") {
      const sys = parseInt(formSystolic);
      const dia = parseInt(formDiastolic);
      if (isNaN(sys) || isNaN(dia)) {
        alert("Please enter numeric systolic and diastolic values.");
        return;
      }
      body.systolic = sys;
      body.diastolic = dia;
    } else if (formType === "custom") {
      const val = parseFloat(formValue);
      if (isNaN(val)) {
        alert("Please enter a numeric value.");
        return;
      }
      body.value = val;
      body.customLabel = formCustomLabel.trim() || "Custom";
    } else {
      const val = parseFloat(formValue);
      if (isNaN(val)) {
        alert("Please enter a numeric value.");
        return;
      }
      body.value = val;
    }

    try {
      const res = await fetch("/api/health-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setFormValue("");
        setFormSystolic("");
        setFormDiastolic("");
        setFormNotes("");
        setFormCustomLabel("");
        fetchData();
      } else {
        alert(json.error?.message || "Failed to log metric");
      }
    } catch (err) {
      console.error(err);
      alert("Error logging health metric.");
    }
  };

  const handleDeleteMetric = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reading?")) return;
    try {
      const res = await fetch(`/api/health-metrics/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert(json.error?.message || "Failed to delete reading");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting reading.");
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  // Compile Latest metric points for card grid
  const getLatestReadings = () => {
    const latest: Record<string, MetricReading> = {};
    const histories: Record<string, number[]> = {};

    // Group history (ascending)
    const reversed = [...metrics].reverse();
    reversed.forEach(m => {
      const t = m.type;
      if (!histories[t]) histories[t] = [];
      const val = t === "blood_pressure" ? m.systolic : m.value;
      if (val !== null && val !== undefined) {
        histories[t].push(val);
      }
    });

    // Extract latest reading
    metrics.forEach(m => {
      const t = m.type;
      if (!latest[t]) {
        latest[t] = m;
      }
    });

    return { latest, histories };
  };

  const { latest, histories } = getLatestReadings();

  // Create Metric Card display items
  const displayCards = Object.keys(METRIC_CONFIG)
    .filter(key => key !== "custom")
    .map(key => {
      const config = METRIC_CONFIG[key];
      const reading = latest[key];
      const history = histories[key] || [];

      // Calculate recent trend label
      let trendLabel = "Stable";
      let trendDir = "neutral";
      if (history.length >= 2) {
        const last = history[history.length - 1];
        const prev = history[history.length - 2];
        const diff = last - prev;
        if (diff > 0) {
          trendLabel = `+${diff.toFixed(1)} vs previous`;
          trendDir = key === "weight" ? "neutral" : "good";
        } else if (diff < 0) {
          trendLabel = `${diff.toFixed(1)} vs previous`;
          trendDir = "good";
        }
      }

      return {
        key,
        label: config.label,
        icon: config.icon,
        iconBg: config.iconBg,
        iconColor: config.iconColor,
        value: reading ? (key === "blood_pressure" && reading.systolic && reading.diastolic ? `${reading.systolic}/${reading.diastolic}` : String(reading.value)) : "--",
        unit: reading?.unit || config.ref.split(" ").slice(-1)[0] || "",
        status: reading?.status || "unknown",
        ref: config.ref,
        trend: trendLabel,
        trendDir,
        history: history.slice(-7)
      };
    });

  // Calculate stats for top row
  const uniqueTracked = Object.keys(latest).length;
  const normalTracked = Object.values(latest).filter(m => m.status === "normal").length;
  const lastLoggedText = metrics[0] ? formatDateTime(metrics[0].timestamp) : "No entries";
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "ME";

  // Build SVG multi-line trend chart points (group by date)
  const chartDates = Array.from(
    new Set(
      [...metrics]
        .reverse()
        .map(m => new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }))
    )
  ).slice(-7);

  const chartData = chartDates.map(d => {
    const dayMetrics = metrics.filter(
      m => new Date(m.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) === d
    );
    const hr = dayMetrics.find(m => m.type === "heart_rate")?.value || null;
    const sbp = dayMetrics.find(m => m.type === "blood_pressure")?.systolic || null;
    const glucose = dayMetrics.find(m => m.type === "glucose")?.value || null;
    return { date: d, hr, sbp, glucose };
  });

  return (
    <div className="app-main-inner">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-date">
          <span className="live-dot" />
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
          })}
        </div>
        <div className="topbar-actions">
          <Link href="/notifications">
            <button className="btn btn-ghost btn-icon" style={{ position: "relative" }}>
              🔔
            </button>
          </Link>
          <Link href="/profile">
            <div className="avatar" style={{ width: 34, height: 34, cursor: "pointer", fontSize: 12 }}>
              {initials}
            </div>
          </Link>
        </div>
      </div>

      {/* Page header */}
      <div className="page-hd anim-fade-up">
        <div>
          <h1 className="page-title">Health Metrics</h1>
          <p className="page-sub">Monitor your vitals and track trends over time</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => alert("Report compiled! Ready to print / save.")}>📤 Export Report</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Log Reading
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {error && (
          <div style={{ padding: "12px 14px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--r-sm)", color: "var(--danger)", fontSize: 13.5 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand-500)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <p style={{ color: "var(--muted)" }}>Loading health data...</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="anim-fade-up d1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {[
                { label: "Metrics tracked", value: uniqueTracked, icon: "📊", bg: "var(--brand-50)", color: "var(--brand-600)" },
                { label: "Normal status", value: `${normalTracked}/${uniqueTracked}`, icon: "✅", bg: "var(--success-bg)", color: "var(--success)" },
                { label: "Last logged", value: lastLoggedText, icon: "🕐", bg: "var(--info-bg)", color: "var(--info)" },
                { label: "Health Score", value: user?.healthScore || 85, icon: "⭐", bg: "var(--warning-bg)", color: "var(--warning)" }
              ].map(s => (
                <div key={s.label} className="card card-p" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--n-900)" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Metric cards grid */}
            <div className="anim-fade-up d2">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)" }}>Latest Readings</h3>
                <div style={{ display: "flex", gap: 4 }}>
                  {["7D", "30D", "90D"].map(r => (
                    <button
                      key={r}
                      onClick={() => setActiveRange(r)}
                      className={`btn btn-sm ${activeRange === r ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "4px 12px", fontSize: 12 }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                {displayCards.map(m => (
                  <div key={m.key} className="card" style={{ padding: "18px 20px", transition: "all .2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: m.iconBg,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                        {m.icon}
                      </div>
                      <span className={`badge ${m.status === "normal" ? "badge-green" : m.status === "high" || m.status === "critical" ? "badge-red" : "badge-yellow"}`} style={{ fontSize: 10.5 }}>
                        ● {m.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1, color: "var(--n-900)" }}>
                        {m.value}
                        <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-body)", fontWeight: 400, marginLeft: 4 }}>
                          {m.unit}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--n-700)", marginTop: 3 }}>{m.label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>Ref: {m.ref}</div>
                    </div>

                    <Sparkline data={m.history} color={m.iconColor} />

                    <div style={{ marginTop: 8, fontSize: 11.5, color: m.trendDir === "good" ? "var(--success)" : "var(--muted)", fontWeight: 600 }}>
                      {m.trendDir === "good" ? "↗ " : "→ "}{m.trend}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* History chart */}
            {chartDates.length > 0 && (
              <div className="anim-fade-up d3 card card-p">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)" }}>Trends Over Time</h3>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Heart rate, Blood pressure & Blood glucose</p>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      { color: "var(--brand-500)", label: "Heart Rate", dashed: false },
                      { color: "#7c3aed", label: "Systolic BP", dashed: true },
                      { color: "#2563eb", label: "Blood Glucose", dashed: false }
                    ].map(({ color, label, dashed }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{
                          width: 24, height: 2, borderRadius: 1,
                          borderTop: dashed ? `2px dashed ${color}` : "none",
                          background: dashed ? "none" : color
                        }} />
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 200, position: "relative" }}>
                  <svg viewBox="0 0 700 180" style={{ width: "100%", height: "100%" }}>
                    {/* Grid lines */}
                    {[0, 36, 72, 108, 144].map(y => (
                      <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="var(--border)" strokeWidth=".7" />
                    ))}
                    {/* Y labels */}
                    {[
                      { y: 10, label: "130" },
                      { y: 46, label: "100" },
                      { y: 82, label: "80" },
                      { y: 118, label: "70" },
                      { y: 154, label: "60" }
                    ].map(({ y, label }) => (
                      <text key={y} x="0" y={y} fontSize="10" fill="var(--n-400)">{label}</text>
                    ))}

                    {/* X labels */}
                    {chartDates.map((d, i) => (
                      <text key={d} x={40 + i * 100} y="175" fontSize="10" fill="var(--n-400)" textAnchor="middle">
                        {d}
                      </text>
                    ))}

                    {/* Heart Rate line */}
                    {chartData.some(d => d.hr !== null) && (
                      <path
                        d={`M ${chartData.map((d, i) => {
                          const val = d.hr || 70;
                          return `${40 + i * 100},${180 - ((val - 60) / 70) * 140}`;
                        }).join(" L ")}`}
                        fill="none" stroke="var(--brand-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      />
                    )}
                    {chartData.map((d, i) => d.hr !== null && (
                      <circle key={`hr-${i}`} cx={40 + i * 100} cy={180 - ((d.hr - 60) / 70) * 140}
                        r="4" fill="var(--brand-500)" stroke="white" strokeWidth="2" />
                    ))}

                    {/* Systolic BP line */}
                    {chartData.some(d => d.sbp !== null) && (
                      <path
                        d={`M ${chartData.map((d, i) => {
                          const val = d.sbp || 120;
                          return `${40 + i * 100},${180 - ((val - 100) / 40) * 140}`;
                        }).join(" L ")}`}
                        fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round"
                      />
                    )}

                    {/* Glucose line */}
                    {chartData.some(d => d.glucose !== null) && (
                      <path
                        d={`M ${chartData.map((d, i) => {
                          const val = d.glucose || 90;
                          return `${40 + i * 100},${180 - ((val - 70) / 50) * 140}`;
                        }).join(" L ")}`}
                        fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </div>
              </div>
            )}

            {/* History table */}
            <div className="anim-fade-up d4 card">
              <div style={{ padding: "18px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)" }}>Measurement History</h3>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Complete log of all recorded readings</p>
                </div>
              </div>
              <div className="tbl-wrap" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
                {metrics.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                    No metric entries logged yet. Click "+ Log Reading" to add.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Logged Value</th>
                        <th>Notes</th>
                        <th>Source</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map(row => {
                        const config = METRIC_CONFIG[row.type] || METRIC_CONFIG.custom;
                        const statusColors: Record<string, string> = {
                          normal: "badge-green",
                          low: "badge-yellow",
                          high: "badge-red",
                          critical: "badge-red"
                        };
                        return (
                          <tr key={row.id}>
                            <td>
                              <span style={{ fontWeight: 600, color: "var(--n-800)" }}>
                                {formatDateTime(row.timestamp)}
                              </span>
                            </td>
                            <td>
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span>{config.icon}</span>
                                <span>{row.type === "custom" ? row.customLabel : config.label}</span>
                              </span>
                            </td>
                            <td><strong>{row.displayValue}</strong></td>
                            <td><span style={{ color: "var(--muted)", fontSize: 12 }}>{row.notes || "—"}</span></td>
                            <td><span className="badge badge-slate" style={{ fontSize: 10 }}>{row.source}</span></td>
                            <td>
                              <span className={`badge ${statusColors[row.status] || "badge-slate"}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 12, padding: "4px 8px", color: "var(--danger)" }}
                                onClick={() => handleDeleteMetric(row.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Reference ranges */}
            <div className="anim-fade-up d5 card card-p">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)", marginBottom: 4 }}>Reference Ranges</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>Standard thresholds for clinical metrics</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {Object.keys(METRIC_CONFIG)
                  .filter(key => key !== "custom" && latest[key])
                  .map(key => {
                    const m = METRIC_CONFIG[key];
                    const val = latest[key]?.value || 0;
                    const pct = ((val - m.min) / (m.max - m.min)) * 100;
                    const status = latest[key]?.status || "unknown";

                    return (
                      <div key={key} style={{ padding: "12px 14px", background: "var(--n-50)", borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 16 }}>{m.icon}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--n-700)" }}>{m.label}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Range: {m.ref}</div>
                        <div className="progress" style={{ height: 6 }}>
                          <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: status === "normal" ? "var(--success)" : "var(--danger)" }} />
                        </div>
                        <div style={{ fontSize: 11, color: status === "normal" ? "var(--success)" : "var(--danger)", fontWeight: 600, marginTop: 5 }}>
                          ● {status === "normal" ? "In normal range" : `${status} reading`}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Reading Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
        }} onClick={() => setShowAddModal(false)}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)",
            padding: "32px", width: "100%", maxWidth: 480, boxShadow: "var(--shadow-xl)"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--n-900)", fontWeight: 700 }}>Log a Reading</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLogReading} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Metric Type</label>
                <select
                  className="form-control"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  style={{ appearance: "auto" }}
                >
                  <option value="heart_rate">Heart Rate</option>
                  <option value="blood_pressure">Blood Pressure</option>
                  <option value="glucose">Blood Glucose</option>
                  <option value="oxygen_saturation">Oxygen Saturation</option>
                  <option value="weight">Weight</option>
                  <option value="cholesterol">Cholesterol</option>
                  <option value="bmi">BMI</option>
                  <option value="temperature">Temperature</option>
                  <option value="sleep">Sleep</option>
                  <option value="custom">Custom Metric</option>
                </select>
              </div>

              {formType === "custom" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Custom Label</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. HbA1c"
                    value={formCustomLabel}
                    onChange={(e) => setFormCustomLabel(e.target.value)}
                    required
                  />
                </div>
              )}

              {formType === "blood_pressure" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Systolic (mmHg)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="120"
                      value={formSystolic}
                      onChange={(e) => setFormSystolic(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Diastolic (mmHg)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="80"
                      value={formDiastolic}
                      onChange={(e) => setFormDiastolic(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Value</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="72"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Unit</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="bpm"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Recorded At</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={formTimestamp}
                  onChange={(e) => setFormTimestamp(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Notes (optional)</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Any additional details (e.g. fasting)"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  style={{ resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Reading</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}