"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";

const initialAppointments = [
  {
    id: "a1",
    doctor: "Dr. Sarah Chen",
    specialty: "Cardiologist",
    date: "Jun 10, 2026",
    time: "10:30 AM",
    type: "Follow-up",
    location: "Boston Cardiac Center · Suite 302",
    address: "45 Park Ave, Boston, MA 02101",
    status: "upcoming",
    notes: "Bring recent BP logs. Discuss Lisinopril dosage adjustment.",
    init: "SC",
    color: "#f0fdf4",
    textColor: "var(--success)",
    phone: "+1 (617) 555-0191",
  },
  {
    id: "a2",
    doctor: "Dr. Michael Torres",
    specialty: "Primary Care",
    date: "Jun 15, 2026",
    time: "2:00 PM",
    type: "Routine Checkup",
    location: "Boston Medical Group",
    address: "12 Commonwealth Ave, Boston, MA 02116",
    status: "upcoming",
    notes: "Annual physical. Fasting required — no food 8 hours before.",
    init: "MT",
    color: "var(--brand-50)",
    textColor: "var(--brand-600)",
    phone: "+1 (617) 555-0182",
  },
  {
    id: "a3",
    doctor: "Dr. Priya Patel",
    specialty: "Endocrinologist",
    date: "Jun 28, 2026",
    time: "9:00 AM",
    type: "Diabetes Review",
    location: "Joslin Diabetes Center",
    address: "1 Joslin Place, Boston, MA 02215",
    status: "upcoming",
    notes: "3-month HbA1c review. Bring glucose logs from last 30 days.",
    init: "PP",
    color: "var(--warning-bg)",
    textColor: "var(--warning)",
    phone: "+1 (617) 555-0174",
  },
  {
    id: "a4",
    doctor: "Dr. Sarah Chen",
    specialty: "Cardiologist",
    date: "Apr 2, 2026",
    time: "11:00 AM",
    type: "Follow-up",
    location: "Boston Cardiac Center · Suite 302",
    address: "45 Park Ave, Boston, MA 02101",
    status: "completed",
    notes: "BP stable at 118/76. Continue Lisinopril. Next follow-up in 2 months.",
    init: "SC",
    color: "#f0fdf4",
    textColor: "var(--success)",
    phone: "+1 (617) 555-0191",
  },
  {
    id: "a5",
    doctor: "Dr. Michael Torres",
    specialty: "Primary Care",
    date: "Mar 15, 2026",
    time: "9:30 AM",
    type: "Lab Results Review",
    location: "Boston Medical Group",
    address: "12 Commonwealth Ave, Boston, MA 02116",
    status: "completed",
    notes: "HbA1c improved to 5.4%. Lipid panel normal. Excellent progress.",
    init: "MT",
    color: "var(--brand-50)",
    textColor: "var(--brand-600)",
    phone: "+1 (617) 555-0182",
  },
];

const specialists = [
  { name: "Dr. Sarah Chen", spec: "Cardiologist", init: "SC", rating: 4.9, next: "Jun 10", color: "#f0fdf4" },
  { name: "Dr. Michael Torres", spec: "Primary Care", init: "MT", rating: 4.8, next: "Jun 15", color: "var(--brand-50)" },
  { name: "Dr. Priya Patel", spec: "Endocrinologist", init: "PP", rating: 4.9, next: "Jun 28", color: "var(--warning-bg)" },
];

export default function AppointmentsPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");
  const [showBookModal, setShowBookModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState(initialAppointments);

  const [bookingDoc, setBookingDoc] = useState("Dr. Sarah Chen — Cardiologist");
  const [bookingType, setBookingType] = useState("Follow-up");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate || !bookingTime) {
      alert("Please specify preferred date and time.");
      return;
    }
    const nameOnly = bookingDoc.split(" — ")[0];
    const specOnly = bookingDoc.split(" — ")[1] || "Specialist";
    const init = nameOnly.split(" ").slice(1).map(n => n[0]).join("");

    const newAppt = {
      id: `a_${Date.now()}`,
      doctor: nameOnly,
      specialty: specOnly,
      date: new Date(bookingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: bookingTime,
      type: bookingType,
      location: "Boston Health Pavilion",
      address: "800 Boylston St, Boston, MA 02199",
      status: "upcoming",
      notes: bookingNotes,
      init: init || "MD",
      color: "var(--brand-50)",
      textColor: "var(--brand-600)",
      phone: "+1 (617) 555-1234"
    };

    setAppointments(prev => [newAppt, ...prev]);
    setShowBookModal(false);
    setBookingNotes("");
    setBookingDate("");
    setBookingTime("");
    alert("Appointment request submitted successfully!");
  };

  const handleCancelAppt = (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const filtered = appointments.filter(
    (a) => filter === "all" || a.status === filter
  );

  return (
    <div className="app-main-inner">
      <Topbar
        title="Appointments"
        subtitle="Manage your medical appointments and care team"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => alert("Appointment summary exported successfully!")}>📤 Export</button>
            <button className="btn btn-primary" onClick={() => setShowBookModal(true)}>
              + Book Appointment
            </button>
          </>
        }
      />

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Stats */}
        <div className="anim-fade-up d1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[
            { label: "Upcoming", value: appointments.filter((a) => a.status === "upcoming").length, icon: "📅", bg: "var(--brand-50)", color: "var(--brand-600)" },
            { label: "This month", value: appointments.filter((a) => a.status === "upcoming" && a.date.includes("2026")).length, icon: "🗓", bg: "var(--info-bg)", color: "var(--info)" },
            { label: "Care team", value: specialists.length, icon: "👨‍⚕️", bg: "var(--success-bg)", color: "var(--success)" },
            { label: "Completed past", value: appointments.filter((a) => a.status === "completed").length, icon: "✅", bg: "var(--warning-bg)", color: "var(--warning)" },
          ].map((s) => (
            <div key={s.label} className="card card-p" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1, color: "var(--n-900)" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="anim-fade-up d2" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>

          {/* Left: appointments list */}
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {(["all", "upcoming", "completed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`}
                  style={{ textTransform: "capitalize" }}
                >
                  {f === "all" ? `All (${appointments.length})` : f === "upcoming" ? `Upcoming (${appointments.filter((a) => a.status === "upcoming").length})` : `Past (${appointments.filter((a) => a.status === "completed").length})`}
                </button>
              ))}
            </div>

            {/* Appointment cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.length === 0 ? (
                <div className="card card-p" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                  No appointments found matching this filter.
                </div>
              ) : (
                filtered.map((appt) => {
                  const isExpanded = expandedId === appt.id;
                  return (
                    <div key={appt.id} className="card" style={{
                      overflow: "hidden",
                      borderLeft: `4px solid ${appt.textColor}`,
                      transition: "all .2s",
                    }}>
                      <div
                        style={{ padding: "18px 20px", cursor: "pointer" }}
                        onClick={() => setExpandedId(isExpanded ? null : appt.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div className="avatar" style={{
                            width: 46, height: 46, background: appt.color,
                            color: appt.textColor, fontSize: 13, flexShrink: 0,
                          }}>
                            {appt.init}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--n-900)" }}>{appt.doctor}</span>
                              <span className="badge badge-slate" style={{ fontSize: 11 }}>{appt.specialty}</span>
                              {appt.status === "upcoming" && (
                                <span className="badge badge-brand" style={{ fontSize: 11 }}>Upcoming</span>
                              )}
                              {appt.status === "completed" && (
                                <span className="badge badge-green" style={{ fontSize: 11 }}>✓ Completed</span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--muted)" }}>
                              {appt.type} · {appt.location}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: appt.textColor }}>{appt.date}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{appt.time}</div>
                          </div>
                          <span style={{ color: "var(--n-400)", marginLeft: 8, transition: "transform .2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div style={{
                          padding: "0 20px 18px",
                          borderTop: "1px solid var(--border-subtle)",
                          paddingTop: 16,
                        }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                            {[
                              ["📍 Location", appt.address],
                              ["📞 Phone", appt.phone],
                              ["📋 Type", appt.type],
                              ["🕐 Time", appt.time],
                            ].map(([l, v]) => (
                              <div key={l} style={{ padding: "10px 13px", background: "var(--n-50)", borderRadius: "var(--r-sm)" }}>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{l}</div>
                                <div style={{ fontSize: 13, color: "var(--n-700)", fontWeight: 500 }}>{v}</div>
                              </div>
                            ))}
                          </div>
                          {appt.notes && (
                            <div style={{
                              padding: "12px 14px", background: "var(--info-bg)",
                              borderRadius: "var(--r-sm)", border: "1px solid var(--info-border)",
                              fontSize: 13, color: "var(--info)", marginBottom: 14,
                            }}>
                              📝 {appt.notes}
                            </div>
                          )}
                          {appt.status === "upcoming" && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => alert("Please contact care coordinator to reschedule.")}>Reschedule</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => alert("Added to device calendar!")}>Add to Calendar</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", marginLeft: "auto" }} onClick={() => handleCancelAppt(appt.id)}>Cancel</button>
                            </div>
                          )}
                          {appt.status === "completed" && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => alert(`Notes: ${appt.notes}`)}>View Notes</button>
                              <button className="btn btn-primary btn-sm" onClick={() => { setShowBookModal(true); setBookingDoc(`${appt.doctor} — ${appt.specialty}`); }}>Book Follow-up</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: care team + calendar mini */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Mini calendar */}
            <div className="card card-p">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>June 2026</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                  <div key={d + Math.random()} style={{ fontSize: 10, fontWeight: 700, color: "var(--n-400)", padding: "4px 0" }}>{d}</div>
                ))}
                {Array.from({ length: 1 }, () => null).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
                  const hasAppt = [10, 15, 28].includes(d);
                  return (
                    <div key={d} style={{
                      padding: "5px 0", fontSize: 12,
                      borderRadius: 6, cursor: hasAppt ? "pointer" : "default",
                      background: hasAppt ? "var(--brand-100)" : "transparent",
                      color: hasAppt ? "var(--brand-700)" : "var(--n-600)",
                      fontWeight: hasAppt ? 700 : 400,
                      position: "relative",
                    }}>
                      {d}
                      {hasAppt && (
                        <div style={{
                          position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)",
                          width: 4, height: 4, borderRadius: "50%", background: "var(--brand-500)",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Care team */}
            <div className="card card-p">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--n-900)", marginBottom: 14 }}>Your Care Team</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {specialists.map((s) => (
                  <div key={s.name} style={{
                    padding: "12px 14px", background: "var(--n-50)",
                    borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div className="avatar" style={{ width: 38, height: 38, background: s.color, fontSize: 11 }}>
                      {s.init}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--n-800)" }}>{s.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.spec}</div>
                      <div style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 600 }}>Next: {s.next}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--n-400)", fontWeight: 600 }}>⭐ {s.rating}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={() => alert("Add specialist workflow is locked for demo.")}>
                + Add a provider
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Book modal */}
      {showBookModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
        }} onClick={() => setShowBookModal(false)}>
          <form onSubmit={handleBook} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: "32px", width: "100%", maxWidth: 480,
            boxShadow: "var(--shadow-xl)",
          }} onClick={(e) => e.stopPropagation()} className="anim-scale-in">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--n-900)", fontWeight: 700 }}>Book Appointment</h2>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowBookModal(false)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Provider</label>
                <select className="form-control" style={{ appearance: "auto" }} value={bookingDoc} onChange={(e) => setBookingDoc(e.target.value)}>
                  <option value="Dr. Sarah Chen — Cardiologist">Dr. Sarah Chen — Cardiologist</option>
                  <option value="Dr. Michael Torres — Primary Care">Dr. Michael Torres — Primary Care</option>
                  <option value="Dr. Priya Patel — Endocrinologist">Dr. Priya Patel — Endocrinologist</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Appointment Type</label>
                <select className="form-control" style={{ appearance: "auto" }} value={bookingType} onChange={(e) => setBookingType(e.target.value)}>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Routine Checkup">Routine Checkup</option>
                  <option value="Lab Results Review">Lab Results Review</option>
                  <option value="New Concern">New Concern</option>
                  <option value="Urgent Care">Urgent Care</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Preferred Date</label>
                  <input type="date" className="form-control" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Preferred Time</label>
                  <input type="time" className="form-control" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--n-600)", display: "block", marginBottom: 5 }}>Notes for doctor</label>
                <textarea className="form-control" rows={3} placeholder="Describe your concern or reason for visit..." style={{ resize: "none" }} value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBookModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Request Appointment</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}