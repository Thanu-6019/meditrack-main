"use client";
// src/app/(protected)/scanner/page.tsx
// Image → API (OCR.space + Gemini) → Review Screen → Save Medicine

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStep = "idle" | "scanning" | "reviewing" | "success";

interface AiAnalysis {
  medicineName: string | null;
  normalizedMedicineName: string | null;
  genericName: string | null;
  dosage: string | null;
  frequency: string | null;
  frequencyCode: string | null;
  duration: string | null;
  prescribedBy: string | null;
  instructions: string | null;
  warnings: string[];
  category: string | null;
  confidence: number;
  ocrCorrectionsMade: boolean;
}

interface ScanResult {
  scanId: string;
  rawText: string;
  ocrConfidence: number;
  aiAnalysis: AiAnalysis;
  overallConfidence: number;
  processingTimeMs: number;
}

interface EditFields {
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  instructions: string;
  notes: string;
}

const FREQUENCY_OPTS = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "four_times_daily", label: "Four times daily" },
  { value: "every_other_day", label: "Every other day" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
];

const TIPS = [
  "Lay the prescription flat and ensure text is fully visible",
  "Good lighting helps — avoid shadows across the label",
  "Photos taken in landscape mode scan more accurately",
  "Make sure the drug name, dosage, and SIG lines are in frame",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [step, setStep] = useState<ScanStep>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"upload" | "camera">("upload");
  const [tipIdx, setTipIdx] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingMed, setSavingMed] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({
    name: "", dosage: "", frequency: "once_daily",
    prescribedBy: "", instructions: "", notes: "",
  });
  const [user, setUser] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load context data ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [userRes, medsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/medicines"),
      ]);
      const [userData, medsData] = await Promise.all([
        userRes.json(),
        medsRes.json(),
      ]);
      if (userData.success) setUser(userData.data.user);
      if (medsData.success) {
        const list = medsData.data.medicines ?? [];
        setTotalScanned(list.length);
        setRecentScans(
          list.slice(0, 3).map((m: any) => ({
            name: `${m.name} ${m.dosage}`,
            date: new Date(m.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric",
            }),
            confidence: 90 + Math.floor(Math.random() * 10),
          }))
        );
      }
    } catch (err) {
      console.error("Scanner context load error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    setTipIdx(Math.floor(Math.random() * TIPS.length));
  }, [fetchData]);

  // ── Main scan handler ───────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setStep("scanning");
    setProgress(10);
    setProgressMsg("Uploading image to OCR engine…");

    try {
      // Step 1: OCR (40%)
      setProgress(15);
      setProgressMsg("Extracting text from prescription…");

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/scanner", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      setProgress(60);
      setProgressMsg("Running AI medicine analysis…");

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message ?? "Scan failed");
      }

      setProgress(90);
      setProgressMsg("Structuring results…");

      const result: ScanResult = data.data;
      setScanResult(result);

      // Pre-fill edit fields from AI analysis
      const ai = result.aiAnalysis;
      setEditFields({
        name: ai.normalizedMedicineName ?? ai.medicineName ?? "",
        dosage: ai.dosage ?? "",
        frequency: ai.frequencyCode ?? "once_daily",
        prescribedBy: ai.prescribedBy ?? "",
        instructions: ai.instructions ?? "",
        notes: "",
      });

      setProgress(100);
      setTimeout(() => setStep("reviewing"), 300);
    } catch (err: any) {
      console.error("[scanner]", err);
      setProgressMsg(`Error: ${err.message}`);
      setProgress(0);
      // Stay on scanning step so user sees the error, then allow reset
      setTimeout(() => {
        alert(`Scan failed: ${err.message}\n\nTip: Check your connection and try again.`);
        reset();
      }, 500);
    }
  }, []);

  const reset = () => {
    setStep("idle");
    setImagePreview(null);
    setScanResult(null);
    setEditFields({ name: "", dosage: "", frequency: "once_daily", prescribedBy: "", instructions: "", notes: "" });
    setProgress(0);
    setProgressMsg("");
    setEditMode(false);
    setShowRaw(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Save to medicines DB ────────────────────────────────────────────────
  const confirmAdd = async () => {
    const fields = editFields;
    if (!fields.name?.trim()) {
      alert("Medicine name is required.");
      return;
    }
    try {
      setSavingMed(true);
      const body = {
        name: fields.name.trim(),
        dosage: fields.dosage.trim() || "As prescribed",
        frequency: fields.frequency || "once_daily",
        prescribedBy: fields.prescribedBy?.trim() || null,
        instructions: fields.instructions?.trim() || null,
        notes: fields.notes?.trim()
          ? `${fields.notes}\n\nScan ID: ${scanResult?.scanId ?? "n/a"} | AI confidence: ${Math.round((scanResult?.overallConfidence ?? 0) * 100)}%`
          : `Scan ID: ${scanResult?.scanId ?? "n/a"} | AI confidence: ${Math.round((scanResult?.overallConfidence ?? 0) * 100)}%`,
        startDate: new Date().toISOString().split("T")[0],
        status: "active",
        // Store AI analysis metadata
        genericName: scanResult?.aiAnalysis?.genericName ?? null,
        condition: scanResult?.aiAnalysis?.category ?? null,
        sideEffects: [],
        interactions: [],
      };

      const res = await fetch("/api/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setStep("success");
        fetchData();
      } else {
        alert(json.error?.message ?? "Failed to save prescription.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error saving prescription. Please try again.");
    } finally {
      setSavingMed(false);
    }
  };

  const fieldChange = (k: keyof EditFields, v: string) =>
    setEditFields((f) => ({ ...f, [k]: v }));

  // ── Confidence badge ─────────────────────────────────────────────────────
  const conf = scanResult?.overallConfidence ?? 0;
  const confPct = Math.round(conf * 100);
  const confBadge =
    conf >= 0.8
      ? { cls: "badge-green", icon: "✓", label: `${confPct}% confidence` }
      : conf >= 0.6
      ? { cls: "badge-yellow", icon: "⚠", label: `${confPct}% — review carefully` }
      : { cls: "badge-red", icon: "✕", label: `${confPct}% — low confidence` };

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "ME";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-main-inner">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-date">
          <span className="live-dot" />
          {new Date().toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          })}
        </div>
        <div className="topbar-actions">
          <Link href="/notifications">
            <button className="btn btn-ghost btn-icon" aria-label="Notifications">
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
          <h1 className="page-title">Prescription Scanner</h1>
          <p className="page-sub">
            AI-powered OCR extracts and analyzes medicine information automatically
          </p>
        </div>
        {step !== "idle" && step !== "scanning" && (
          <button className="btn btn-secondary" onClick={reset}>↩ Scan another</button>
        )}
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── IDLE: Upload UI ───────────────────────────────────────────────── */}
        {step === "idle" && (
          <div className="anim-fade-up d1" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, padding: "3px", background: "var(--n-100)", borderRadius: "var(--r-sm)", width: "fit-content" }}>
                {(["upload", "camera"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className="btn btn-sm"
                    style={{
                      background: activeTab === t ? "white" : "transparent",
                      color: activeTab === t ? "var(--n-900)" : "var(--n-500)",
                      boxShadow: activeTab === t ? "var(--shadow-xs)" : "none",
                      fontWeight: activeTab === t ? 700 : 500,
                      padding: "6px 16px",
                    }}
                  >
                    {t === "upload" ? "📁 Upload image" : "📷 Use camera"}
                  </button>
                ))}
              </div>

              {activeTab === "upload" ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? "var(--brand-400)" : "var(--border)"}`,
                    borderRadius: "var(--r-lg)",
                    background: isDragging ? "var(--brand-50)" : "var(--surface-2)",
                    padding: "56px 40px",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 14, cursor: "pointer", transition: "all .2s",
                  }}
                >
                  <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: isDragging ? "var(--brand-100)" : "var(--n-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30,
                  }}>
                    {isDragging ? "📥" : "🖼"}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--n-800)", marginBottom: 4 }}>
                      {isDragging ? "Drop to scan" : "Drop prescription image here"}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>
                      or click to browse · JPG, PNG, PDF supported
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Choose file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: "none" }}
                    onChange={onFileChange}
                  />
                </div>
              ) : (
                <div className="scanner-viewport" style={{ borderRadius: "var(--r-lg)", minHeight: 320 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div className="scanner-crosshair">
                      <div className="scanner-line" />
                    </div>
                    <p style={{ color: "rgba(255,255,255,.6)", fontSize: 13, textAlign: "center", maxWidth: 260 }}>
                      Camera access requires browser permissions.
                    </p>
                    <button
                      className="btn btn-sm"
                      style={{ background: "rgba(255,255,255,.15)", color: "white", border: "1px solid rgba(255,255,255,.25)" }}
                      onClick={() => setActiveTab("upload")}
                    >
                      Use file upload instead
                    </button>
                  </div>
                </div>
              )}

              {/* AI badge */}
              <div style={{
                padding: "14px 18px", background: "var(--brand-50)",
                borderRadius: "var(--r-md)", border: "1px solid var(--brand-100)",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>✦</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-700)", marginBottom: 2 }}>
                    AI-powered analysis
                  </div>
                  <p style={{ fontSize: 13, color: "var(--brand-600)", lineHeight: 1.5, margin: 0 }}>
                    {TIPS[tipIdx]}. After OCR extraction, Gemini AI corrects errors and normalizes medicine data.
                  </p>
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card card-p">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>Scanner stats</h3>
                {[
                  { label: "Prescriptions tracked", value: totalScanned, icon: "📋" },
                  { label: "OCR engine", value: "OCR.space", icon: "🔍" },
                  { label: "AI model", value: "Gemini", icon: "✦" },
                  { label: "Scanner status", value: "Ready", icon: "🎯" },
                ].map((s) => (
                  <div key={s.label} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 0", borderBottom: "1px solid var(--border-subtle)",
                  }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--n-700)" }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n-900)", fontFamily: "var(--font-display)" }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card card-p">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>Recent scans</h3>
                {recentScans.length === 0 ? (
                  <div style={{ padding: "12px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    No recent scans recorded.
                  </div>
                ) : (
                  recentScans.map((s, idx) => (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", background: "var(--n-50)",
                      borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)",
                      marginBottom: idx < recentScans.length - 1 ? 8 : 0,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, background: "var(--success-bg)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                      }}>💊</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--n-800)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.date}</div>
                      </div>
                      <span className="badge badge-green" style={{ fontSize: 10.5 }}>✓ Added</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SCANNING: Progress ─────────────────────────────────────────────── */}
        {step === "scanning" && (
          <div className="anim-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {imagePreview && (
                <div style={{
                  borderRadius: "var(--r-lg)", overflow: "hidden",
                  border: "1px solid var(--border-subtle)", background: "var(--n-900)",
                  maxHeight: 340, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Prescription" style={{ maxWidth: "100%", maxHeight: 340, objectFit: "contain" }} />
                </div>
              )}

              <div className="card card-p">
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: "var(--brand-50)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, animation: "spin 2s linear infinite",
                  }}>✦</div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--n-900)" }}>Processing…</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{progressMsg}</div>
                  </div>
                  <div style={{
                    marginLeft: "auto", fontFamily: "var(--font-display)",
                    fontSize: 22, color: "var(--brand-600)", minWidth: 48, textAlign: "right",
                  }}>
                    {progress}%
                  </div>
                </div>
                <div className="progress" style={{ height: 8 }}>
                  <div
                    className="progress-bar"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--brand-400), var(--brand-600))", transition: "width .4s ease" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Upload", done: progress >= 15 },
                    { label: "OCR extraction", done: progress >= 60 },
                    { label: "AI analysis", done: progress >= 90 },
                    { label: "Complete", done: progress >= 100 },
                  ].map((stage) => (
                    <div key={stage.label} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 11px", borderRadius: "var(--r-full)",
                      background: stage.done ? "var(--success-bg)" : "var(--n-100)",
                      border: `1px solid ${stage.done ? "var(--success-border)" : "var(--border)"}`,
                      fontSize: 12, fontWeight: stage.done ? 600 : 400,
                      color: stage.done ? "var(--success)" : "var(--n-400)",
                    }}>
                      {stage.done ? "✓ " : ""}{stage.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card card-p" style={{ background: "linear-gradient(160deg, var(--brand-700), var(--brand-900))", border: "none" }}>
              <div style={{ color: "white" }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>✦</div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 10 }}>AI Pipeline</h3>
                <p style={{ fontSize: 13.5, opacity: .75, lineHeight: 1.7, marginBottom: 20 }}>
                  Your prescription is being processed through two stages:
                </p>
                {[
                  ["🔍", "OCR.space", "Extracts raw text from the image"],
                  ["✦", "Gemini AI", "Corrects errors & normalizes medicine data"],
                ].map(([icon, name, desc]) => (
                  <div key={name} style={{
                    display: "flex", gap: 10, padding: "9px 12px",
                    background: "rgba(255,255,255,.08)", borderRadius: "var(--r-sm)",
                    fontSize: 13, color: "rgba(255,255,255,.8)", marginBottom: 8,
                  }}>
                    <span>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{name}</div>
                      <div style={{ opacity: .7, fontSize: 12 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── REVIEWING: Results ─────────────────────────────────────────────── */}
        {step === "reviewing" && scanResult && (
          <div className="anim-fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header bar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                background: conf >= 0.8 ? "var(--success-bg)" : conf >= 0.6 ? "var(--warning-bg)" : "var(--danger-bg)",
                borderRadius: "var(--r-md)",
                border: `1px solid ${conf >= 0.8 ? "var(--success-border)" : conf >= 0.6 ? "var(--warning-border)" : "var(--danger-border)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{conf >= 0.8 ? "✅" : conf >= 0.6 ? "⚠️" : "❌"}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--n-800)" }}>
                      Analysis complete — {confBadge.label}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      {scanResult.aiAnalysis.ocrCorrectionsMade
                        ? "AI corrected OCR errors. Review each field before saving."
                        : "Review each field before saving."}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(!editMode)}>
                    {editMode ? "✓ Done editing" : "✏ Edit fields"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setShowRaw(!showRaw)}>
                    {showRaw ? "Hide" : "Show"} raw OCR
                  </button>
                </div>
              </div>

              {/* AI Analysis details */}
              {scanResult.aiAnalysis.category && (
                <div style={{
                  padding: "10px 16px", background: "var(--brand-50)",
                  borderRadius: "var(--r-sm)", border: "1px solid var(--brand-100)",
                  display: "flex", gap: 10, alignItems: "center",
                }}>
                  <span style={{ fontSize: 16 }}>💊</span>
                  <span style={{ fontSize: 13, color: "var(--brand-700)", fontWeight: 600 }}>
                    Category: {scanResult.aiAnalysis.category}
                  </span>
                  {scanResult.aiAnalysis.warnings.length > 0 && (
                    <span className="badge badge-yellow" style={{ marginLeft: "auto", fontSize: 11 }}>
                      ⚠ {scanResult.aiAnalysis.warnings.length} warning(s)
                    </span>
                  )}
                </div>
              )}

              {/* Fields */}
              <div className="card card-p">
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--n-900)", marginBottom: 20 }}>
                  Extracted medicine data
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(
                    [
                      { key: "name" as const, label: "Medicine name", icon: "💊", required: true, isSelect: false },
                      { key: "dosage" as const, label: "Dosage", icon: "⚖", required: true, isSelect: false },
                      { key: "frequency" as const, label: "Frequency", icon: "🔁", required: false, isSelect: true },
                      { key: "prescribedBy" as const, label: "Prescribing doctor", icon: "👨‍⚕️", required: false, isSelect: false },
                      { key: "instructions" as const, label: "Instructions", icon: "📋", required: false, isSelect: false },
                      { key: "notes" as const, label: "Additional notes", icon: "📝", required: false, isSelect: false },
                    ] as Array<{ key: keyof EditFields; label: string; icon: string; required: boolean; isSelect: boolean }>
                  ).map(({ key, label, icon, required, isSelect }) => {
                    const value = editFields[key];
                    const isEmpty = !value;
                    return (
                      <div key={key} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isEmpty && key !== "notes" ? "var(--n-100)" : "var(--brand-50)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 17, flexShrink: 0, marginTop: 1,
                        }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--n-500)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                              {label}
                            </span>
                            {required && <span className="badge badge-brand" style={{ fontSize: 10 }}>Required</span>}
                            {isEmpty && key !== "notes" && !editMode && (
                              <span className="badge badge-yellow" style={{ fontSize: 10 }}>Not detected</span>
                            )}
                          </div>
                          {editMode ? (
                            isSelect ? (
                              <select
                                className="input"
                                value={value}
                                onChange={(e) => fieldChange(key, e.target.value)}
                                style={{ fontSize: 14, appearance: "auto" }}
                              >
                                {FREQUENCY_OPTS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="input"
                                value={value}
                                onChange={(e) => fieldChange(key, e.target.value)}
                                placeholder={`Enter ${label.toLowerCase()}…`}
                                style={{ fontSize: 14 }}
                              />
                            )
                          ) : (
                            isSelect ? (
                              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--n-800)", padding: "4px 0" }}>
                                {FREQUENCY_OPTS.find(o => o.value === value)?.label ?? value ?? "—"}
                              </div>
                            ) : (
                              <div style={{
                                fontSize: 14.5,
                                fontWeight: isEmpty ? 400 : 600,
                                color: isEmpty ? "var(--n-400)" : "var(--n-800)",
                                padding: "8px 12px",
                                background: isEmpty && key !== "notes" ? "var(--n-50)" : "transparent",
                                borderRadius: isEmpty && key !== "notes" ? "var(--r-sm)" : 0,
                                fontStyle: isEmpty && key !== "notes" ? "italic" : "normal",
                                border: isEmpty && key !== "notes" ? "1px dashed var(--border)" : "none",
                              }}>
                                {isEmpty ? (key === "notes" ? "" : `${label} — not detected`) : value}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warnings */}
              {scanResult.aiAnalysis.warnings.length > 0 && (
                <div style={{
                  padding: "14px 16px", background: "var(--warning-bg)",
                  borderRadius: "var(--r-md)", border: "1px solid var(--warning-border)",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warning)", marginBottom: 8 }}>
                    ⚠️ AI-detected warnings
                  </div>
                  {scanResult.aiAnalysis.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 13, color: "var(--n-700)", marginBottom: 4 }}>• {w}</div>
                  ))}
                </div>
              )}

              {/* Raw OCR toggle */}
              {showRaw && (
                <div className="card card-p anim-fade-in">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--n-700)" }}>Raw OCR text</h4>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className={`badge ${confBadge.cls}`}>{confBadge.label}</span>
                      <span className="badge badge-slate" style={{ fontSize: 10 }}>
                        OCR.space Engine 2
                      </span>
                    </div>
                  </div>
                  <pre style={{
                    fontSize: 12, color: "var(--n-600)", background: "var(--n-50)",
                    padding: "14px 16px", borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border-subtle)",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    lineHeight: 1.6, maxHeight: 220, overflowY: "auto",
                    margin: 0, fontFamily: "ui-monospace, monospace",
                  }}>
                    {scanResult.rawText || "No text extracted."}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-secondary" onClick={reset} style={{ flex: "0 0 auto" }}>
                  ↩ Rescan
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, opacity: savingMed ? 0.8 : 1 }}
                  onClick={confirmAdd}
                  disabled={!editFields.name?.trim() || savingMed}
                >
                  {savingMed ? (
                    <>
                      <span style={{
                        display: "inline-block", width: 16, height: 16,
                        border: "2px solid rgba(255,255,255,.35)", borderTopColor: "white",
                        borderRadius: "50%", animation: "spin .65s linear infinite",
                      }} />
                      Saving…
                    </>
                  ) : "✓ Add to My Medicines"}
                </button>
              </div>
            </div>

            {/* Right: image + confidence breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {imagePreview && (
                <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Prescription" style={{ width: "100%", display: "block" }} />
                </div>
              )}

              <div className="card card-p">
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>Analysis scores</h4>
                {[
                  { label: "OCR confidence", value: Math.round(scanResult.ocrConfidence * 100), unit: "%" },
                  { label: "AI confidence", value: Math.round(scanResult.aiAnalysis.confidence * 100), unit: "%" },
                  { label: "Overall confidence", value: Math.round(scanResult.overallConfidence * 100), unit: "%" },
                  { label: "Processing time", value: scanResult.processingTimeMs, unit: "ms" },
                ].map((s) => (
                  <div key={s.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12.5,
                  }}>
                    <span style={{ color: "var(--n-600)" }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: "var(--n-800)" }}>{s.value}{s.unit}</span>
                  </div>
                ))}
                <div style={{ padding: "7px 0", fontSize: 12.5, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--n-600)" }}>OCR corrections</span>
                  <span style={{ fontWeight: 700, color: scanResult.aiAnalysis.ocrCorrectionsMade ? "var(--warning)" : "var(--success)" }}>
                    {scanResult.aiAnalysis.ocrCorrectionsMade ? "Yes" : "None needed"}
                  </span>
                </div>
              </div>

              <div className="card card-p">
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>
                  Field detection
                </h4>
                {([
                  ["Medicine name", editFields.name],
                  ["Dosage", editFields.dosage],
                  ["Frequency", editFields.frequency],
                  ["Prescriber", editFields.prescribedBy],
                  ["Instructions", editFields.instructions],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12.5,
                  }}>
                    <span style={{ color: "var(--n-600)" }}>{label}</span>
                    {val
                      ? <span className="badge badge-green" style={{ fontSize: 10.5 }}>✓ Found</span>
                      : <span className="badge badge-slate" style={{ fontSize: 10.5 }}>Not found</span>
                    }
                  </div>
                ))}
              </div>

              <div style={{
                padding: "12px 14px", background: "var(--brand-50)",
                borderRadius: "var(--r-md)", border: "1px solid var(--brand-100)",
                fontSize: 12.5, color: "var(--brand-700)", lineHeight: 1.55,
                display: "flex", gap: 10,
              }}>
                <span style={{ flexShrink: 0 }}>🔐</span>
                <span>Your scan is processed server-side. Images are not stored.</span>
              </div>
            </div>
          </div>
        )}

        {/* ── SUCCESS ───────────────────────────────────────────────────────── */}
        {step === "success" && (
          <div className="anim-scale-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 0" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "var(--success-bg)", border: "3px solid var(--success-border)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38,
            }}>✅</div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--n-900)", marginBottom: 8 }}>
                Medicine added successfully
              </h2>
              <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 400, lineHeight: 1.6 }}>
                <strong style={{ color: "var(--n-800)" }}>{editFields.name || "Your medicine"}</strong>
                {editFields.dosage ? ` (${editFields.dosage})` : ""} has been added to your medicine list.
              </p>
              {scanResult && (
                <p style={{ fontSize: 13, color: "var(--brand-600)", marginTop: 8, fontWeight: 600 }}>
                  AI confidence: {Math.round(scanResult.overallConfidence * 100)}% · Scan ID: {scanResult.scanId}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={reset}>Scan another prescription</button>
              <Link href="/medicines">
                <button className="btn btn-primary">View my medicines →</button>
              </Link>
            </div>
            <div style={{
              padding: "20px 28px", background: "var(--n-50)",
              borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)",
              width: "100%", maxWidth: 480,
            }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--n-700)", marginBottom: 12 }}>What happens next</h4>
              {[
                "Your medicine is now tracked in your daily schedule",
                "You'll receive reminders at your scheduled dose times",
                "Adherence data will begin building from tomorrow",
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13.5, color: "var(--n-700)" }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--brand-100)", color: "var(--brand-700)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}