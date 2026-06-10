"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";

interface AdherenceByDay {
  day: string;
  rate: number;
  taken: number;
  missed: number;
}

interface AdherenceByWeek {
  week: string;
  rate: number;
  taken: number;
  missed: number;
}

interface AdherenceByMed {
  name: string;
  rate: number;
  taken: number;
  missed: number;
  color: string;
  colorBg: string;
}

interface HealthTrendPoint {
  date: string;
  heartRate: number;
  systolic: number;
  glucose: number;
  weight: number;
}

interface DoseTime {
  hour: string;
  doses: number;
  missed: number;
}

interface MissReason {
  reason: string;
  count: number;
  pct: number;
}

interface HbA1cEntry {
  quarter: string;
  val: number;
  status: "high" | "warn" | "good";
}

interface SummaryStatCard {
  icon: string;
  iconBg: string;
  val: string;
  lbl: string;
  trend: string;
  dir: "good" | "neutral" | "warn";
}

interface LatestHealthReading {
  icon: string;
  iconBg: string;
  val: string;
  unit: string;
  lbl: string;
  delta: string;
}

interface Insight {
  type: "positive" | "warn";
  icon: string;
  iconBg: string;
  borderColor: string;
  textColor: string;
  tag: string;
  title: string;
  body: string;
}

interface Recommendation {
  icon: string;
  priority: "High" | "Medium" | "Low";
  text: string;
  action: string;
}

const ADHERENCE_BY_DAY: AdherenceByDay[] = [
  { day: "Mon", rate: 100, taken: 4, missed: 0 },
  { day: "Tue", rate: 75,  taken: 3, missed: 1 },
  { day: "Wed", rate: 100, taken: 4, missed: 0 },
  { day: "Thu", rate: 50,  taken: 2, missed: 2 },
  { day: "Fri", rate: 100, taken: 4, missed: 0 },
  { day: "Sat", rate: 75,  taken: 3, missed: 1 },
  { day: "Sun", rate: 100, taken: 4, missed: 0 },
];

const ADHERENCE_BY_WEEK: AdherenceByWeek[] = [
  { week: "May 6",  rate: 86, taken: 24, missed: 4 },
  { week: "May 13", rate: 93, taken: 26, missed: 2 },
  { week: "May 20", rate: 79, taken: 22, missed: 6 },
  { week: "May 27", rate: 96, taken: 27, missed: 1 },
  { week: "Jun 3",  rate: 89, taken: 25, missed: 3 },
  { week: "Jun 10", rate: 93, taken: 26, missed: 2 },
];

const ADHERENCE_BY_MED: AdherenceByMed[] = [
  { name: "Metformin",    rate: 91, taken: 39, missed: 4, color: "var(--brand-500)", colorBg: "#edfaf7" },
  { name: "Lisinopril",   rate: 78, taken: 33, missed: 9, color: "var(--purple)",    colorBg: "#faf5ff" },
  { name: "Atorvastatin", rate: 95, taken: 41, missed: 2, color: "var(--success)",   colorBg: "#fffbeb" },
  { name: "Vitamin D3",   rate: 100,taken: 43, missed: 0, color: "var(--info)",      colorBg: "#eff6ff" },
];

const HEALTH_TREND_DATA: HealthTrendPoint[] = [
  { date: "May 25", heartRate: 73, systolic: 123, glucose: 99, weight: 72.1 },
  { date: "May 28", heartRate: 71, systolic: 118, glucose: 93, weight: 71.9 },
  { date: "May 30", heartRate: 75, systolic: 121, glucose: 95, weight: 71.8 },
  { date: "Jun 2",  heartRate: 68, systolic: 119, glucose: 98, weight: 71.6 },
  { date: "Jun 4",  heartRate: 74, systolic: 122, glucose: 91, weight: 71.4 },
  { date: "Jun 6",  heartRate: 70, systolic: 120, glucose: 97, weight: 71.5 },
  { date: "Jun 8",  heartRate: 72, systolic: 118, glucose: 94, weight: 71.2 },
];

const DOSE_TIMES: DoseTime[] = [
  { hour: "6 AM",  doses: 1, missed: 0 },
  { hour: "8 AM",  doses: 2, missed: 0 },
  { hour: "12 PM", doses: 1, missed: 1 },
  { hour: "6 PM",  doses: 0, missed: 0 },
  { hour: "8 PM",  doses: 2, missed: 1 },
];

const MISS_REASONS: MissReason[] = [
  { reason: "Forgot",         count: 5, pct: 42 },
  { reason: "Away from home", count: 4, pct: 33 },
  { reason: "Ran out",        count: 2, pct: 17 },
  { reason: "Side effects",   count: 1, pct: 8  },
];

const HBA1C_HISTORY: HbA1cEntry[] = [
  { quarter: "Q2 2023", val: 7.2, status: "high" },
  { quarter: "Q3 2023", val: 6.1, status: "warn" },
  { quarter: "Q4 2023", val: 5.7, status: "good" },
  { quarter: "Q1 2024", val: 5.4, status: "good" },
];

const SUMMARY_STATS: SummaryStatCard[] = [
  { icon: "📊", iconBg: "var(--brand-50)",   val: "91%", lbl: "Overall adherence",    trend: "+3% vs last period", dir: "good"    },
  { icon: "✅", iconBg: "var(--success-bg)", val: "147", lbl: "Doses taken on time",  trend: "Last 30 days",       dir: "neutral" },
  { icon: "⚠️", iconBg: "var(--warning-bg)", val: "12",  lbl: "Doses missed",          trend: "7.5% miss rate",     dir: "warn"    },
  { icon: "🔥", iconBg: "var(--purple-bg)",  val: "11",  lbl: "Day streak",            trend: "Personal best: 18d", dir: "good"    },
];

const LATEST_HEALTH_READINGS: LatestHealthReading[] = [
  { icon: "♥",  iconBg: "#fff1f2", val: "72",     unit: "bpm",   lbl: "Heart Rate",      delta: "+2"  },
  { icon: "🩺", iconBg: "#f0fdf4", val: "118/76", unit: "mmHg",  lbl: "Blood Pressure",  delta: "−4"  },
  { icon: "🩸", iconBg: "#fffbeb", val: "94",     unit: "mg/dL", lbl: "Blood Glucose",   delta: "−3"  },
  { icon: "⚖",  iconBg: "#f5f3ff", val: "71.2",  unit: "kg",    lbl: "Weight",           delta: "−0.3"},
];

const INSIGHTS: Insight[] = [
  {
    type: "positive",
    icon: "🎯",
    iconBg: "var(--success-bg)",
    borderColor: "var(--success-border)",
    textColor: "var(--success)",
    tag: "Strength",
    title: "Strong evening adherence",
    body: "You take your 8 PM doses on time 98% of the time. Your evening routine is your most reliable window — consider scheduling any new medicines then.",
  },
  {
    type: "warn",
    icon: "⚠️",
    iconBg: "var(--warning-bg)",
    borderColor: "var(--warning-border)",
    textColor: "var(--warning)",
    tag: "Watch",
    title: "Lunchtime doses are your weak spot",
    body: "Lisinopril (12 PM) is missed 22% of the time — 3× more than your other medications. Consider setting a calendar alert or moving the dose to breakfast.",
  },
  {
    type: "positive",
    icon: "📈",
    iconBg: "var(--brand-50)",
    borderColor: "var(--brand-100)",
    textColor: "var(--brand-600)",
    tag: "Trend",
    title: "HbA1c responding to treatment",
    body: "Your blood sugar control has improved from 7.2% to 5.4% over 12 months — well within the normal range. This correlates with your Metformin adherence staying above 90%.",
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  { icon: "⏰", priority: "High",   text: "Set a 12 PM alarm specifically for Lisinopril — your most-missed dose.", action: "Set reminder" },
  { icon: "💊", priority: "Medium", text: "Your Lisinopril supply runs out in 8 days. Request a refill to avoid a gap.", action: "Request refill" },
  { icon: "🩺", priority: "Medium", text: "Your next HbA1c test is overdue. Schedule a lab visit with Dr. Chen.", action: "Book appointment" },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"adherence" | "trends">("adherence");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--n-20)" }}>
      <Topbar title="Reports & Insights" />

      <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        
        {/* Summary Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {SUMMARY_STATS.map((stat, idx) => (
            <div key={idx} style={{
              background: "var(--surface)",
              borderRadius: "var(--r-lg)",
              padding: 20,
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 16
            }}>
              <span style={{
                fontSize: 24,
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: stat.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>{stat.icon}</span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--n-800)" }}>{stat.val}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{stat.lbl}</div>
                <div style={{
                  fontSize: 11,
                  marginTop: 4,
                  fontWeight: 600,
                  color: stat.dir === "good" ? "var(--success)" : stat.dir === "warn" ? "var(--danger)" : "var(--muted)"
                }}>{stat.trend}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <button
            onClick={() => setActiveTab("adherence")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--r-md)",
              border: "none",
              background: activeTab === "adherence" ? "var(--brand-600)" : "transparent",
              color: activeTab === "adherence" ? "white" : "var(--n-600)",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Adherence Report
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--r-md)",
              border: "none",
              background: activeTab === "trends" ? "var(--brand-600)" : "transparent",
              color: activeTab === "trends" ? "white" : "var(--n-600)",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Health Trends
          </button>
        </div>

        {activeTab === "adherence" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24 }}>
            {/* Adherence by Medication */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-800)", marginBottom: 16 }}>Adherence by Medication</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {ADHERENCE_BY_MED.map((med, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--n-800)" }}>
                      <span>{med.name}</span>
                      <span>{med.rate}% ({med.taken}/{med.taken + med.missed} doses)</span>
                    </div>
                    <div style={{ height: 8, width: "100%", background: "var(--n-100)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${med.rate}%`, background: med.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adherence by Day of Week */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-800)", marginBottom: 16 }}>Weekly Adherence Pattern</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 180, padding: "0 10px" }}>
                {ADHERENCE_BY_DAY.map((day, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>{day.rate}%</div>
                    <div style={{
                      height: `${day.rate * 1.2}px`,
                      width: 16,
                      background: day.rate >= 90 ? "var(--brand-500)" : day.rate >= 75 ? "var(--warning)" : "var(--danger)",
                      borderRadius: 4
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)" }}>{day.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24 }}>
            {/* Latest Readings */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-800)", marginBottom: 16 }}>Latest Health Readings</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {LATEST_HEALTH_READINGS.map((reading, idx) => (
                  <div key={idx} style={{
                    padding: 16,
                    borderRadius: "var(--r-md)",
                    background: "var(--n-20)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4
                  }}>
                    <span style={{ fontSize: 20 }}>{reading.icon}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{reading.lbl}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--n-800)" }}>
                      {reading.val} <span style={{ fontSize: 11, fontWeight: 500 }}>{reading.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* HbA1c Control History */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-800)", marginBottom: 16 }}>HbA1c Trend</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {HBA1C_HISTORY.map((entry, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: idx < 3 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--n-700)" }}>{entry.quarter}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--n-800)" }}>{entry.val}%</span>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: entry.status === "good" ? "var(--success-bg)" : entry.status === "warn" ? "var(--warning-bg)" : "var(--danger-bg)",
                        color: entry.status === "good" ? "var(--success)" : entry.status === "warn" ? "var(--warning)" : "var(--danger)"
                      }}>
                        {entry.status === "good" ? "Optimal" : entry.status === "warn" ? "Moderate" : "Elevated"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Insights & Recommendations */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 24 }}>
          {/* Insights */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-800)", marginBottom: 16 }}>AI Clinical Insights</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {INSIGHTS.map((insight, idx) => (
                <div key={idx} style={{
                  padding: 16,
                  borderRadius: "var(--r-md)",
                  border: `1px solid ${insight.borderColor}`,
                  background: insight.iconBg,
                  display: "flex",
                  gap: 12
                }}>
                  <span style={{ fontSize: 20 }}>{insight.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: insight.textColor }}>{insight.title}</div>
                    <div style={{ fontSize: 12, color: "var(--n-700)", marginTop: 4, lineHeight: 1.4 }}>{insight.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-800)", marginBottom: 16 }}>Recommended Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {RECOMMENDATIONS.map((rec, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{rec.icon}</span>
                    <span style={{ fontSize: 13, color: "var(--n-700)", fontWeight: 500 }}>{rec.text}</span>
                  </div>
                  <button style={{
                    padding: "6px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--brand-600)",
                    color: "white",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}>{rec.action}</button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}