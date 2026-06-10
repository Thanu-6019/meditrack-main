"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function calculateAge(dobString: string) {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [user, setUser] = useState<any>(null);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states for editing
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editBloodType, setEditBloodType] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editPrimaryDoctor, setEditPrimaryDoctor] = useState("");
  const [editEmergencyContact, setEditEmergencyContact] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (userData.success && userData.data?.user) {
        const u = userData.data.user;
        setUser(u);
        setEditName(u.name || "");
        setEditEmail(u.email || "");
        setEditPhone(u.phone || "");
        setEditDob(u.dateOfBirth ? u.dateOfBirth.split("T")[0] : "");
        setEditAddress(u.address || "");
        setEditBloodType(u.bloodType || u.healthProfile?.bloodType || "");
        setEditHeight(u.height || u.healthProfile?.height || "");
        setEditWeight(u.weight || u.healthProfile?.weight || "");
        setEditPrimaryDoctor(u.primaryDoctor || "");
        setEditEmergencyContact(u.emergencyContact || "");
      }

      const medsRes = await fetch("/api/medicines");
      const medsData = await medsRes.json();
      if (medsData.success) {
        setMedicines(medsData.data.medicines || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const payload = {
        name: editName,
        email: editEmail,
        phone: editPhone,
        dateOfBirth: editDob || null,
        age: editDob ? calculateAge(editDob) : null,
        address: editAddress,
        bloodType: editBloodType,
        height: editHeight,
        weight: editWeight,
        primaryDoctor: editPrimaryDoctor,
        emergencyContact: editEmergencyContact,
        healthProfile: {
          weight: parseFloat(editWeight) || null,
          bloodPressure: user?.healthProfile?.bloodPressure || null,
          glucoseLevel: user?.healthProfile?.glucoseLevel || null
        }
      };

      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update profile");
      }

      setUser(data.data.user);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return "?";
    return nameStr
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = user?.name ? getInitials(user.name) : "?";

  // Calculate dynamic stats
  const activeMedicationsCount = medicines.filter(m => m.status === "active").length;
  const avgAdherence = medicines.length > 0
    ? Math.round(medicines.reduce((acc, m) => acc + (m.adherenceRate ?? 100), 0) / medicines.length)
    : 100;

  const weightNum = parseFloat(editWeight || user?.weight || user?.healthProfile?.weight || "0");
  const heightNum = parseFloat(editHeight || user?.height || user?.healthProfile?.height || "0") / 100;
  const bmiVal = (weightNum && heightNum) ? (weightNum / (heightNum * heightNum)).toFixed(1) : null;
  const bmiStatus = bmiVal ? (parseFloat(bmiVal) < 18.5 ? "Underweight" : parseFloat(bmiVal) < 25 ? "Normal" : "Overweight") : "--";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "medical", label: "Medical History" },
    { key: "labs", label: "Lab Results" },
    { key: "insurance", label: "Insurance" },
  ];

  if (loading) {
    return (
      <div className="app-main-inner" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block", width: 40, height: 40, border: "4px solid var(--border)", borderTopColor: "var(--brand-500)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <p style={{ color: "var(--muted)" }}>Loading profile data...</p>
        </div>
      </div>
    );
  }

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
            <button className="btn btn-ghost btn-icon" style={{ position: "relative" }}>
              🔔
              <span style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", border: "1.5px solid white" }} />
            </button>
          </Link>
          <Link href="/profile">
            <div className="avatar" style={{ width: 34, height: 34, cursor: "pointer", fontSize: 12 }}>
              {initials}
            </div>
          </Link>
        </div>
      </div>

      {/* Profile hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-900) 100%)",
        padding: "32px 36px 80px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", width: 400, height: 400, borderRadius: "50%",
          background: "rgba(255,255,255,.04)", top: -150, right: -100,
        }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(255,255,255,.2)", border: "3px solid rgba(255,255,255,.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: 30, color: "white", flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "white", marginBottom: 4 }}>
              {user?.name || "User Profile"}
            </h1>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                user?.age ? `Age ${user.age}` : "",
                user?.gender ? user.gender.replace("_", " ") : "",
                user?.phone ? user.phone : "",
                user?.createdAt ? `Member since ${new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "",
              ].filter(Boolean).map((s) => (
                <span key={s} style={{ fontSize: 13, color: "rgba(255,255,255,.65)", display: "flex", alignItems: "center", gap: 4 }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              className="btn"
              style={{ background: "rgba(255,255,255,.15)", color: "white", border: "1px solid rgba(255,255,255,.25)" }}
              onClick={editing ? handleSave : () => setEditing(true)}
              disabled={saving}
            >
              {saving ? "Saving..." : editing ? "✓ Save changes" : "✏ Edit profile"}
            </button>
            {editing && (
              <button
                className="btn btn-ghost"
                style={{ color: "white" }}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{
          position: "absolute", bottom: 20, left: 36,
          display: "grid", gridTemplateColumns: "repeat(4, 160px)", gap: 12,
          zIndex: 1,
        }}>
          {[
            { label: "Health Score", value: "84/100", color: "#fff" },
            { label: "Active Medications", value: activeMedicationsCount, color: "#fff" },
            { label: "Adherence Rate", value: `${avgAdherence}%`, color: "#fff" },
            { label: "BMI", value: bmiVal ? `${bmiVal} — ${bmiStatus}` : "--", color: "#fff" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,.1)", borderRadius: "var(--r-md)",
              border: "1px solid rgba(255,255,255,.12)",
              padding: "12px 16px", backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "white", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ marginTop: 0, paddingTop: 0 }}>
        {error && (
          <div style={{ margin: "20px 0 0", padding: "12px 14px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--r-sm)", color: "var(--danger)", fontSize: 13.5 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 2, marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          marginLeft: 0, marginRight: 0,
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "12px 20px",
                fontSize: 13.5, fontWeight: activeTab === t.key ? 700 : 500,
                color: activeTab === t.key ? "var(--brand-600)" : "var(--n-500)",
                borderBottom: activeTab === t.key ? "2px solid var(--brand-500)" : "2px solid transparent",
                background: "none", cursor: "pointer", transition: "all .15s",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="anim-fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Personal info */}
              <div className="card card-p">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>👤</span> Personal Information
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {editing ? (
                    <>
                      {[
                        { label: "Full Name", value: editName, onChange: setEditName, type: "text" },
                        { label: "Email", value: editEmail, onChange: setEditEmail, type: "email" },
                        { label: "Phone", value: editPhone, onChange: setEditPhone, type: "tel" },
                        { label: "Date of Birth", value: editDob, onChange: setEditDob, type: "date" },
                        { label: "Address", value: editAddress, onChange: setEditAddress, type: "text" },
                      ].map((f) => (
                        <div key={f.label} className="field">
                          <label className="field-label">{f.label}</label>
                          <input type={f.type} className="input" value={f.value} onChange={(e) => f.onChange(e.target.value)} />
                        </div>
                      ))}
                    </>
                  ) : (
                    [
                      ["Full Name", user?.name],
                      ["Email", user?.email],
                      ["Phone", user?.phone],
                      ["Date of Birth", user?.dateOfBirth ? formatDate(user.dateOfBirth) : ""],
                      ["Address", user?.address || user?.phone ? "" : ""], // Will fallback to empty state correctly
                    ].map(([l, v]) => {
                      if (!v) return null;
                      return (
                        <div key={l} style={{ display: "flex", gap: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--n-400)", textTransform: "uppercase", letterSpacing: ".06em", width: 120, flexShrink: 0, paddingTop: 1 }}>{l}</div>
                          <div style={{ fontSize: 13.5, color: "var(--n-700)" }}>{v}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Medical info */}
              <div className="card card-p">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🩺</span> Medical Profile
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {editing ? (
                    <>
                      {[
                        { label: "Blood Type", value: editBloodType, onChange: setEditBloodType },
                        { label: "Height (cm)", value: editHeight, onChange: setEditHeight },
                        { label: "Weight (kg)", value: editWeight, onChange: setEditWeight },
                        { label: "Primary Doctor", value: editPrimaryDoctor, onChange: setEditPrimaryDoctor },
                        { label: "Emergency Contact", value: editEmergencyContact, onChange: setEditEmergencyContact },
                      ].map((f) => (
                        <div key={f.label} className="field">
                          <label className="field-label">{f.label}</label>
                          <input type="text" className="input" value={f.value} onChange={(e) => f.onChange(e.target.value)} />
                        </div>
                      ))}
                    </>
                  ) : (
                    [
                      ["Blood Type", user?.bloodType || user?.healthProfile?.bloodType],
                      ["Height", user?.height ? `${user.height} cm` : user?.healthProfile?.height ? `${user.healthProfile.height} cm` : ""],
                      ["Weight", user?.weight ? `${user.weight} kg` : user?.healthProfile?.weight ? `${user.healthProfile.weight} kg` : ""],
                      ["Primary Doctor", user?.primaryDoctor],
                      ["Emergency Contact", user?.emergencyContact],
                    ].map(([l, v]) => {
                      if (!v) return null;
                      return (
                        <div key={l} style={{ display: "flex", gap: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--n-400)", textTransform: "uppercase", letterSpacing: ".06em", width: 140, flexShrink: 0, paddingTop: 1 }}>{l}</div>
                          <div style={{ fontSize: 13.5, color: "var(--n-700)" }}>{v}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Conditions & Allergies */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div className="card card-p">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🏥</span> Active Conditions
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    padding: "16px", background: "var(--n-50)",
                    borderRadius: "var(--r-sm)", border: "1px dashed var(--border)",
                    textAlign: "center", color: "var(--muted)", fontSize: 13
                  }}>
                    No active conditions recorded.
                  </div>
                </div>
              </div>

              <div className="card card-p">
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span> Allergies & Intolerances
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    padding: "16px", background: "var(--n-50)",
                    borderRadius: "var(--r-sm)", border: "1px dashed var(--border)",
                    textAlign: "center", color: "var(--muted)", fontSize: 13
                  }}>
                    No allergies or intolerances recorded.
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }}>+ Add allergy</button>
                </div>
              </div>
            </div>

            {/* Current Medications summary */}
            <div className="card card-p">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)" }}>💊 Current Medications</h3>
                <Link href="/medicines"><button className="btn btn-ghost btn-sm">Manage →</button></Link>
              </div>
              {medicines.length === 0 ? (
                <div style={{
                  padding: "20px", background: "var(--n-50)",
                  borderRadius: "var(--r-md)", border: "1px dashed var(--border)",
                  textAlign: "center", color: "var(--muted)", fontSize: 13.5
                }}>
                  No active medications recorded.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                  {medicines.map((m) => (
                    <div key={m.id || m._id} style={{
                      padding: "11px 14px", background: "var(--n-50)",
                      borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: m.colorBg || "var(--brand-50)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💊</div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--n-800)" }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.dosage} · {m.frequency?.replace("_", " ")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vaccinations */}
            <div className="card card-p">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 16 }}>💉 Vaccination Record</h3>
              <div style={{
                padding: "20px", background: "var(--n-50)",
                borderRadius: "var(--r-md)", border: "1px dashed var(--border)",
                textAlign: "center", color: "var(--muted)", fontSize: 13.5
              }}>
                No vaccinations recorded.
              </div>
            </div>
          </div>
        )}

        {/* Medical History tab */}
        {activeTab === "medical" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="anim-fade-in">
            <div className="card card-p">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)", marginBottom: 18 }}>Medical Timeline</h3>
              <div style={{
                padding: "30px 20px", background: "var(--n-50)",
                borderRadius: "var(--r-md)", border: "1px dashed var(--border)",
                textAlign: "center", color: "var(--muted)", fontSize: 13.5
              }}>
                No medical timeline events recorded.
              </div>
            </div>
          </div>
        )}

        {/* Lab Results tab */}
        {activeTab === "labs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="anim-fade-in">
            <div className="card">
              <div style={{ padding: "18px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)" }}>Lab Results</h3>
              </div>
              <div style={{
                padding: "30px 20px", background: "var(--n-50)",
                borderRadius: "var(--r-md)", border: "1px dashed var(--border)",
                textAlign: "center", color: "var(--muted)", fontSize: 13.5,
                margin: "0 22px 22px"
              }}>
                No lab results recorded.
              </div>
            </div>
          </div>
        )}

        {/* Insurance tab */}
        {activeTab === "insurance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="anim-fade-in">
            <div style={{
              padding: "40px 20px", background: "var(--n-50)",
              borderRadius: "var(--r-lg)", border: "1px dashed var(--border)",
              textAlign: "center", color: "var(--muted)", fontSize: 13.5
            }}>
              No insurance information recorded.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}