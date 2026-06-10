"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";

interface MedicineType {
  id: string;
  name: string;
  genericName?: string | null;
  dosage: string;
  form?: string | null;
  frequency: string;
  timesPerDay?: number;
  timeSchedule?: string[];
  startDate?: string;
  endDate?: string | null;
  prescribedBy?: string | null;
  condition?: string | null;
  purpose?: string | null;
  pillsRemaining?: number | null;
  totalPills?: number | null;
  refillDate?: string | null;
  pharmacy?: string | null;
  routeOfAdministration?: string;
  instructions?: string | null;
  notes?: string | null;
  sideEffects?: string[];
  interactions?: string[];
  status: string;
  takenToday: boolean;
}

const FREQUENCIES = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "four_times_daily", label: "Four times daily" },
  { value: "every_other_day", label: "Every other day" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
];

const ROUTES = [
  { value: "oral", label: "Oral" },
  { value: "topical", label: "Topical" },
  { value: "inhalation", label: "Inhalation" },
  { value: "injection", label: "Injection" },
  { value: "sublingual", label: "Sublingual" },
  { value: "rectal", label: "Rectal" },
  { value: "ophthalmic", label: "Ophthalmic" },
  { value: "otic", label: "Otic" },
  { value: "nasal", label: "Nasal" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "discontinued", label: "Discontinued" },
];

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<MedicineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [selectedMed, setSelectedMed] = useState<MedicineType | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formGeneric, setFormGeneric] = useState("");
  const [formDosage, setFormDosage] = useState("");
  const [formForm, setFormForm] = useState("Tablet");
  const [formFrequency, setFormFrequency] = useState("once_daily");
  const [formTimes, setFormTimes] = useState("08:00");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState("");
  const [formPrescribedBy, setFormPrescribedBy] = useState("");
  const [formCondition, setFormCondition] = useState("");
  const [formPurpose, setFormPurpose] = useState("");
  const [formPillsRemaining, setFormPillsRemaining] = useState("");
  const [formTotalPills, setFormTotalPills] = useState("");
  const [formRefillDate, setFormRefillDate] = useState("");
  const [formPharmacy, setFormPharmacy] = useState("");
  const [formRoute, setFormRoute] = useState("oral");
  const [formInstructions, setFormInstructions] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSideEffects, setFormSideEffects] = useState("");
  const [formInteractions, setFormInteractions] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/medicines");
      const json = await res.json();
      if (json.success) {
        setMedicines(json.data.medicines || []);
      } else {
        setError(json.error?.message || "Failed to load medicines.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch medicines from the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, []);

  const openAddModal = () => {
    setFormName("");
    setFormGeneric("");
    setFormDosage("");
    setFormForm("Tablet");
    setFormFrequency("once_daily");
    setFormTimes("08:00");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormPrescribedBy("");
    setFormCondition("");
    setFormPurpose("");
    setFormPillsRemaining("");
    setFormTotalPills("");
    setFormRefillDate("");
    setFormPharmacy("");
    setFormRoute("oral");
    setFormInstructions("");
    setFormNotes("");
    setFormSideEffects("");
    setFormInteractions("");
    setFormStatus("active");
    setShowAddModal(true);
  };

  const openEditModal = (med: MedicineType) => {
    setSelectedMed(med);
    setFormName(med.name || "");
    setFormGeneric(med.genericName || "");
    setFormDosage(med.dosage || "");
    setFormForm(med.form || "Tablet");
    setFormFrequency(med.frequency || "once_daily");
    setFormTimes((med.timeSchedule || []).join(", ") || "08:00");
    setFormStartDate(med.startDate ? new Date(med.startDate).toISOString().split("T")[0] : "");
    setFormEndDate(med.endDate ? new Date(med.endDate).toISOString().split("T")[0] : "");
    setFormPrescribedBy(med.prescribedBy || "");
    setFormCondition(med.condition || "");
    setFormPurpose(med.purpose || "");
    setFormPillsRemaining(med.pillsRemaining !== null && med.pillsRemaining !== undefined ? String(med.pillsRemaining) : "");
    setFormTotalPills(med.totalPills !== null && med.totalPills !== undefined ? String(med.totalPills) : "");
    setFormRefillDate(med.refillDate ? new Date(med.refillDate).toISOString().split("T")[0] : "");
    setFormPharmacy(med.pharmacy || "");
    setFormRoute(med.routeOfAdministration || "oral");
    setFormInstructions(med.instructions || "");
    setFormNotes(med.notes || "");
    setFormSideEffects((med.sideEffects || []).join(", "));
    setFormInteractions((med.interactions || []).join(", "));
    setFormStatus(med.status || "active");
    setShowEditModal(true);
  };

  const handleSaveMedicine = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    if (!formName.trim() || !formDosage.trim()) {
      alert("Name and dosage are required.");
      return;
    }

    const timeSchedule = formTimes.split(",").map(t => t.trim()).filter(Boolean);
    const sideEffects = formSideEffects.split(",").map(s => s.trim()).filter(Boolean);
    const interactions = formInteractions.split(",").map(i => i.trim()).filter(Boolean);

    const body = {
      name: formName.trim(),
      genericName: formGeneric.trim() || null,
      dosage: formDosage.trim(),
      form: formForm.trim() || null,
      frequency: formFrequency,
      timeSchedule,
      startDate: formStartDate || new Date().toISOString().split("T")[0],
      endDate: formEndDate || null,
      prescribedBy: formPrescribedBy.trim() || null,
      condition: formCondition.trim() || null,
      purpose: formPurpose.trim() || null,
      pillsRemaining: formPillsRemaining ? parseInt(formPillsRemaining) : null,
      totalPills: formTotalPills ? parseInt(formTotalPills) : null,
      refillDate: formRefillDate || null,
      pharmacy: formPharmacy.trim() || null,
      routeOfAdministration: formRoute,
      instructions: formInstructions.trim() || null,
      notes: formNotes.trim() || null,
      sideEffects,
      interactions,
      status: formStatus,
    };

    try {
      const url = isEdit ? `/api/medicines/${selectedMed?.id}` : "/api/medicines";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setShowEditModal(false);
        fetchMedicines();
      } else {
        alert(json.error?.message || "Failed to save medicine");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving the medicine.");
    }
  };

  const handleRemoveMedicine = async (id: string) => {
    if (!confirm("Are you sure you want to remove this prescription?")) return;
    try {
      const res = await fetch(`/api/medicines/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchMedicines();
      } else {
        alert(json.error?.message || "Failed to remove medicine");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting the medicine.");
    }
  };

  const handleLogDose = async (id: string, currentTaken: boolean) => {
    try {
      const res = await fetch(`/api/medicines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takenToday: !currentTaken }),
      });
      const json = await res.json();
      if (json.success) {
        setMedicines(prev =>
          prev.map(m => (m.id === id ? { ...m, takenToday: !currentTaken } : m))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestRefill = async (med: MedicineType) => {
    try {
      // Simulate pill refill request or add half pills back via api update
      const refillAmount = med.totalPills || 30;
      const res = await fetch(`/api/medicines/${med.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillsRemaining: refillAmount }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Refill requested successfully! Stock reset to ${refillAmount} pills.`);
        fetchMedicines();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getMedThemeColor = (formStr: string | null | undefined) => {
    const formLower = formStr?.toLowerCase() || "";
    if (formLower.includes("capsule") || formLower.includes("softgel") || formLower.includes("gel")) {
      return { color: "#2563eb", colorBg: "#eff6ff" };
    }
    if (formLower.includes("tablet")) {
      return { color: "#7c3aed", colorBg: "#faf5ff" };
    }
    if (formLower.includes("injection") || formLower.includes("needle")) {
      return { color: "#d97706", colorBg: "#fffbeb" };
    }
    return { color: "#17998a", colorBg: "#edfaf7" };
  };

  const formatFrequency = (freq: string) => {
    if (!freq) return "";
    return freq.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  // Interaction check algorithm
  const detectInteractions = () => {
    const active = medicines.filter(m => m.status === "active");
    const warnings: Array<{ medA: string; medB: string; triggerWord: string }> = [];

    active.forEach(medA => {
      const nameLower = medA.name.toLowerCase();
      const genericLower = (medA.genericName || "").toLowerCase();

      active.forEach(medB => {
        if (medA.id === medB.id) return;

        // Check if medB's name or generic name matches any listed interaction warning in medA
        const medAInteractions = medA.interactions || [];
        medAInteractions.forEach(trigger => {
          const t = trigger.toLowerCase().trim();
          if (t && (medB.name.toLowerCase().includes(t) || (medB.genericName || "").toLowerCase().includes(t))) {
            // Avoid adding duplicates in reverse order
            const isDup = warnings.some(
              w =>
                (w.medA === medA.name && w.medB === medB.name) ||
                (w.medA === medB.name && w.medB === medA.name)
            );
            if (!isDup) {
              warnings.push({
                medA: medA.name,
                medB: medB.name,
                triggerWord: trigger,
              });
            }
          }
        });
      });
    });

    return warnings;
  };

  const activeMeds = medicines.filter(m => m.status === "active");
  const takenCount = activeMeds.filter(m => m.takenToday).length;
  const refillCount = activeMeds.filter(m => {
    const pRemaining = m.pillsRemaining;
    const pTotal = m.totalPills;
    return pRemaining !== null && pRemaining !== undefined && pTotal && pRemaining < pTotal * 0.3;
  }).length;
  const adherenceRate = activeMeds.length > 0 ? Math.round((takenCount / activeMeds.length) * 100) : 100;

  const interactionWarnings = detectInteractions();

  return (
    <div className="app-main-inner">
      <Topbar
        title="Medicines"
        subtitle="Manage your prescriptions and track daily adherence"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowInteractionModal(true)}>
              📋 Interaction Check {interactionWarnings.length > 0 && `(${interactionWarnings.length})`}
            </button>
            <button className="btn btn-primary" onClick={openAddModal}>+ Add Medicine</button>
          </>
        }
      />

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {error && (
          <div style={{ padding: "12px 14px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--r-sm)", color: "var(--danger)", fontSize: 13.5 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand-500)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <p style={{ color: "var(--muted)" }}>Loading prescriptions...</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="anim-fade-up d1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
              {[
                { label: "Total medicines",  value: activeMeds.length,  icon: "💊", bg: "var(--brand-50)",   color: "var(--brand-600)" },
                { label: "Taken today",      value: `${takenCount}/${activeMeds.length}`, icon: "✅", bg: "var(--success-bg)", color: "var(--success)" },
                { label: "Refills needed",   value: refillCount,                 icon: "⚠️", bg: "var(--warning-bg)", color: "var(--warning)" },
                { label: "Adherence rate",   value: `${adherenceRate}%`,             icon: "📈", bg: "var(--info-bg)",    color: "var(--info)"    },
              ].map(s => (
                <div key={s.label} className="card card-p" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1, color: "var(--n-900)" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Today's schedule */}
            <div className="anim-fade-up d2 card card-p">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)" }}>Today's Schedule</h3>
                <div className="progress" style={{ width: 140, height: 7 }}>
                  <div className="progress-bar" style={{
                    width: `${adherenceRate}%`,
                    background: "var(--brand-500)",
                  }} />
                </div>
              </div>

              {activeMeds.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
                  No active prescriptions scheduled for today. Add one above!
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
                  {activeMeds.map(med => {
                    const theme = getMedThemeColor(med.form);
                    return (
                      <div key={med.id} className="med-row">
                        <div className="med-pill-icon" style={{ background: theme.colorBg }}>{
                          med.form?.toLowerCase().includes("softgel") ? "🫐" : "💊"
                        }</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--n-800)" }}>{med.name}</span>
                            <span className="badge badge-slate" style={{ fontSize: 11 }}>
                              {med.genericName || med.purpose || "Prescription"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{med.dosage} · {formatFrequency(med.frequency)}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>⏰ {(med.timeSchedule || []).join(" · ") || "As needed"}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {med.takenToday ? (
                            <span
                              className="badge badge-green"
                              style={{ cursor: "pointer" }}
                              onClick={() => handleLogDose(med.id, true)}
                            >
                              ✓ Done
                            </span>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleLogDose(med.id, false)}
                            >
                              Log dose
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detailed cards */}
            <div className="anim-fade-up d3">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>All Prescriptions</h3>
              {medicines.length === 0 ? (
                <div className="card card-p" style={{ padding: "50px 20px", textAlign: "center", color: "var(--muted)" }}>
                  No medications found. Add your first medicine to get started tracking.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
                  {medicines.map(med => {
                    const pRemaining = med.pillsRemaining !== null && med.pillsRemaining !== undefined ? med.pillsRemaining : 0;
                    const pTotal = med.totalPills || 1;
                    const pctLeft = Math.round((pRemaining / pTotal) * 100);
                    const isLow = pRemaining < pTotal * 0.3;
                    const theme = getMedThemeColor(med.form);

                    return (
                      <div key={med.id} className="card" style={{ padding: "20px 22px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: 14, background: theme.colorBg,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
                            border: `1.5px solid ${theme.color}30`,
                          }}>💊</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)" }}>{med.name}</span>
                              {med.status === "active" ? (
                                med.takenToday ? (
                                  <span className="badge badge-green">✓ Taken</span>
                                ) : (
                                  <span className="badge badge-yellow">Pending</span>
                                )
                              ) : (
                                <span className="badge badge-slate">{med.status}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                              {med.genericName} · {med.dosage} {med.form}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                              Prescribed by {med.prescribedBy || "Self / OTC"}
                            </div>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                          {[
                            ["Condition", med.condition || "General Health"],
                            ["Frequency", formatFrequency(med.frequency)],
                            ["Schedule",  (med.timeSchedule || []).join(", ") || "As needed"],
                            ["Refill Date", med.refillDate ? new Date(med.refillDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Indefinite"],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={{
                              padding: "9px 11px", background: "var(--n-50)",
                              borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)",
                            }}>
                              <div style={{ fontSize: 11, color: "var(--n-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 2 }}>{lbl}</div>
                              <div style={{ fontSize: 13, color: "var(--n-700)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
                            </div>
                          ))}
                        </div>

                        {/* Pills remaining */}
                        {med.totalPills !== null && med.totalPills !== undefined && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 5 }}>
                              <span>Pills remaining</span>
                              <span style={{ color: isLow ? "var(--danger)" : "var(--n-600)", fontWeight: 600 }}>
                                {pRemaining} / {pTotal}
                                {isLow && " — Refill soon"}
                              </span>
                            </div>
                            <div className="progress" style={{ height: 6 }}>
                              <div className="progress-bar" style={{
                                width: `${Math.min(100, Math.max(0, pctLeft))}%`,
                                background: isLow ? "var(--danger)" : "var(--brand-500)",
                              }} />
                            </div>
                          </div>
                        )}

                        {/* Instructions */}
                        {med.instructions && (
                          <div style={{
                            marginTop: 12, padding: "10px 12px",
                            background: "var(--info-bg)", borderRadius: "var(--r-sm)",
                            border: "1px solid var(--info-border)",
                            fontSize: 12.5, color: "var(--info)", lineHeight: 1.5,
                          }}>
                            ℹ️ {med.instructions}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEditModal(med)}>Edit</button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => handleRequestRefill(med)}
                            disabled={!med.totalPills}
                          >
                            Refill Stock
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--danger)" }}
                            onClick={() => handleRemoveMedicine(med.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side effects info */}
            {activeMeds.some(m => m.sideEffects && m.sideEffects.length > 0) && (
              <div className="anim-fade-up d4 card card-p">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--n-900)", marginBottom: 4 }}>Common Side Effects</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Known effects for your current prescriptions</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                  {activeMeds.filter(m => m.sideEffects && m.sideEffects.length > 0).slice(0,4).map(med => (
                    <div key={med.id} style={{
                      padding: "13px 15px", background: "var(--n-50)",
                      borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--n-800)", marginBottom: 8 }}>
                        {med.name}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(med.sideEffects || []).map(se => (
                          <span key={se} className="badge badge-slate">{se}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Medicine Modal */}
      {(showAddModal || showEditModal) && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: 20
        }}>
          <div className="card card-p" style={{
            width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-xl)",
            animation: "fade-in 0.2s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--n-900)" }}>
                {showEditModal ? "Edit Prescription" : "Add New Prescription"}
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                style={{ fontSize: 18, padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => handleSaveMedicine(e, showEditModal)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Medicine Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Metformin"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Generic Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Metformin HCl"
                    value={formGeneric}
                    onChange={(e) => setFormGeneric(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Dosage *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 500 mg or 1 tablet"
                    value={formDosage}
                    onChange={(e) => setFormDosage(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Form</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Tablet, Capsule, Softgel"
                    value={formForm}
                    onChange={(e) => setFormForm(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Frequency</label>
                  <select
                    className="form-control"
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    style={{ appearance: "auto" }}
                  >
                    {FREQUENCIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Schedule Times (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 08:00, 20:00"
                    value={formTimes}
                    onChange={(e) => setFormTimes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>End Date (Optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Prescribed By</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dr. Sarah Chen"
                    value={formPrescribedBy}
                    onChange={(e) => setFormPrescribedBy(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Treating Condition</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Hypertension"
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Pills Remaining</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 60"
                    value={formPillsRemaining}
                    onChange={(e) => setFormPillsRemaining(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Total Pills / Size</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 60"
                    value={formTotalPills}
                    onChange={(e) => setFormTotalPills(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Refill Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formRefillDate}
                    onChange={(e) => setFormRefillDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Route of Admin</label>
                  <select
                    className="form-control"
                    value={formRoute}
                    onChange={(e) => setFormRoute(e.target.value)}
                    style={{ appearance: "auto" }}
                  >
                    {ROUTES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Instructions</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Take with food. Avoid alcohol."
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Side Effects (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nausea, Dizziness"
                    value={formSideEffects}
                    onChange={(e) => setFormSideEffects(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Interactions (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Alcohol, Aspirin"
                    value={formInteractions}
                    onChange={(e) => setFormInteractions(e.target.value)}
                  />
                </div>
              </div>

              {showEditModal && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Status</label>
                  <select
                    className="form-control"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    style={{ appearance: "auto" }}
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {showEditModal ? "Save Changes" : "Create Prescription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interaction Warning Modal */}
      {showInteractionModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: 20
        }}>
          <div className="card card-p" style={{
            width: "100%", maxWidth: 500,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-xl)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--n-900)", display: "flex", alignItems: "center", gap: 6 }}>
                📋 Drug Interaction Screen
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowInteractionModal(false)}
                style={{ fontSize: 18, padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "350px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {interactionWarnings.length === 0 ? (
                <div style={{ padding: "30px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>No Interactions Found</h4>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    No matching conflict triggers detected among your active medicines.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{
                    padding: "10px 12px", background: "var(--danger-bg)",
                    border: "1px solid var(--danger-border)", borderRadius: "var(--r-sm)",
                    color: "var(--danger)", fontSize: 13, lineHeight: 1.4
                  }}>
                    ⚠️ <strong>Warning:</strong> {interactionWarnings.length} potential interaction warning(s) detected. Please consult your physician.
                  </div>

                  {interactionWarnings.map((w, idx) => (
                    <div key={idx} style={{
                      padding: "12px 14px", border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)", background: "var(--n-50)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n-800)" }}>{w.medA}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>↔</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--n-800)" }}>{w.medB}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                        Trigger keyword: <span style={{ color: "var(--danger)", fontWeight: 600, background: "rgba(239, 68, 68, 0.08)", padding: "1px 6px", borderRadius: 4 }}>{w.triggerWord}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => setShowInteractionModal(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}