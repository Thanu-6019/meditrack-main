"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <label className="switch" onClick={onToggle} style={{ cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={() => {}} />
      <span className="switch-track" />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-p">
      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--n-900)", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>{children}</div>
    </div>
  );
}

function SettingRow({
  icon, label, desc, children,
}: { icon: string; label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: "var(--n-100)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--n-800)" }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 1 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  const [notifs, setNotifs] = useState({
    medicationReminders: true,
    missedDoseAlerts: true,
    refillAlerts: true,
    healthAlerts: false,
    appointmentReminders: true,
    weeklyReport: true,
    emailNotifs: false,
    pushNotifs: true,
  });

  const [privacy, setPrivacy] = useState({
    shareWithDoctor: true,
    anonymousData: false,
    locationAccess: false,
    biometricLock: true,
  });

  const [prefs, setPrefs] = useState({
    darkMode: false,
    compactView: false,
    metricUnits: true,
    showAdherence: true,
    autoRefill: false,
    reminderSound: true,
  });

  const [reminderTime, setReminderTime] = useState("15");
  const [activeSection, setActiveSection] = useState("notifications");

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
        }
      } catch (err) {
        console.error("Failed to load user in settings", err);
      }
    }
    loadUser();
  }, []);

  const toggle = <T extends Record<string, boolean>>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    key: keyof T
  ) => setter((s) => ({ ...s, [key]: !s[key] }));

  const sections = [
    { key: "notifications", label: "Notifications", icon: "🔔" },
    { key: "privacy", label: "Privacy & Security", icon: "🔒" },
    { key: "preferences", label: "Preferences", icon: "⚙️" },
    { key: "account", label: "Account", icon: "👤" },
    { key: "data", label: "Data & Export", icon: "📊" },
    { key: "about", label: "About", icon: "ℹ️" },
  ];

  const name = user?.name || "Patient";
  const email = user?.email || "patient@email.com";
  const phone = user?.phone || "Not provided";
  const doctor = user?.primaryDoctor || "None assigned";
  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "ME";
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Recently";

  return (
    <div className="app-main-inner">
      <Topbar
        title="Settings"
        subtitle="Manage your account, notifications, and preferences"
      />

      <div className="page-body">
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>

          {/* Sidebar nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: "var(--r-sm)",
                  background: activeSection === s.key ? "var(--brand-50)" : "transparent",
                  color: activeSection === s.key ? "var(--brand-700)" : "var(--n-600)",
                  fontWeight: activeSection === s.key ? 700 : 500,
                  fontSize: 13.5, cursor: "pointer", border: "none",
                  textAlign: "left", transition: "all .15s",
                }}
              >
                <span style={{ fontSize: 17 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="anim-fade-in">

            {/* Notifications */}
            {activeSection === "notifications" && (
              <>
                <Section title="🔔 Medication Reminders">
                  <SettingRow icon="💊" label="Medication reminders" desc="Get notified before each scheduled dose">
                    <Toggle on={notifs.medicationReminders} onToggle={() => toggle(setNotifs, "medicationReminders")} />
                  </SettingRow>
                  <SettingRow icon="⏰" label="Reminder lead time" desc="How far in advance to send reminders">
                    <select
                      className="input"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      style={{ width: 120, appearance: "auto" }}
                    >
                      <option value="5">5 min before</option>
                      <option value="15">15 min before</option>
                      <option value="30">30 min before</option>
                      <option value="60">1 hour before</option>
                    </select>
                  </SettingRow>
                  <SettingRow icon="🚫" label="Missed dose alerts" desc="Alert when a dose is skipped or missed">
                    <Toggle on={notifs.missedDoseAlerts} onToggle={() => toggle(setNotifs, "missedDoseAlerts")} />
                  </SettingRow>
                  <SettingRow icon="🔄" label="Refill alerts" desc="Notify when medications are running low">
                    <Toggle on={notifs.refillAlerts} onToggle={() => toggle(setNotifs, "refillAlerts")} />
                  </SettingRow>
                </Section>

                <Section title="📊 Health & Reports">
                  <SettingRow icon="🩺" label="Health metric alerts" desc="Notify when readings are outside normal range">
                    <Toggle on={notifs.healthAlerts} onToggle={() => toggle(setNotifs, "healthAlerts")} />
                  </SettingRow>
                  <SettingRow icon="📅" label="Appointment reminders" desc="Reminders for upcoming medical appointments">
                    <Toggle on={notifs.appointmentReminders} onToggle={() => toggle(setNotifs, "appointmentReminders")} />
                  </SettingRow>
                  <SettingRow icon="📈" label="Weekly health report" desc="Sunday summary of your health metrics and adherence">
                    <Toggle on={notifs.weeklyReport} onToggle={() => toggle(setNotifs, "weeklyReport")} />
                  </SettingRow>
                </Section>

                <Section title="📬 Delivery Channels">
                  <SettingRow icon="✉️" label="Email notifications" desc={`Send notifications to ${email}`}>
                    <Toggle on={notifs.emailNotifs} onToggle={() => toggle(setNotifs, "emailNotifs")} />
                  </SettingRow>
                  <SettingRow icon="📱" label="Push notifications" desc="In-app and browser push notifications">
                    <Toggle on={notifs.pushNotifs} onToggle={() => toggle(setNotifs, "pushNotifs")} />
                  </SettingRow>
                  <SettingRow icon="🔊" label="Sound alerts" desc="Play a sound when reminders arrive">
                    <Toggle on={prefs.reminderSound} onToggle={() => toggle(setPrefs, "reminderSound")} />
                  </SettingRow>
                </Section>
              </>
            )}

            {/* Privacy */}
            {activeSection === "privacy" && (
              <>
                <Section title="🔒 Privacy Settings">
                  <SettingRow icon="🩺" label="Share data with doctor" desc="Allow your care team to view your health records">
                    <Toggle on={privacy.shareWithDoctor} onToggle={() => toggle(setPrivacy, "shareWithDoctor")} />
                  </SettingRow>
                  <SettingRow icon="📊" label="Anonymous analytics" desc="Help improve MediTrack by sharing anonymous usage data">
                    <Toggle on={privacy.anonymousData} onToggle={() => toggle(setPrivacy, "anonymousData")} />
                  </SettingRow>
                  <SettingRow icon="📍" label="Location access" desc="Allow location for pharmacy finder and nearby doctors">
                    <Toggle on={privacy.locationAccess} onToggle={() => toggle(setPrivacy, "locationAccess")} />
                  </SettingRow>
                </Section>

                <Section title="🛡️ Security">
                  <SettingRow icon="👆" label="Biometric lock" desc="Use Face ID or fingerprint to open MediTrack">
                    <Toggle on={privacy.biometricLock} onToggle={() => toggle(setPrivacy, "biometricLock")} />
                  </SettingRow>
                  <SettingRow icon="🔑" label="Change password" desc="Last changed 3 months ago">
                    <button className="btn btn-secondary btn-sm" onClick={() => alert("Change password workflow locked for demo.")}>Change →</button>
                  </SettingRow>
                  <SettingRow icon="📱" label="Two-factor authentication" desc="Add an extra layer of account security">
                    <button className="btn btn-secondary btn-sm" onClick={() => alert("2FA setup workflow locked for demo.")}>Set up →</button>
                  </SettingRow>
                </Section>
              </>
            )}

            {/* Preferences */}
            {activeSection === "preferences" && (
              <>
                <Section title="🎨 Display">
                  <SettingRow icon="🌙" label="Dark mode" desc="Switch to a dark color scheme">
                    <Toggle on={prefs.darkMode} onToggle={() => toggle(setPrefs, "darkMode")} />
                  </SettingRow>
                  <SettingRow icon="📐" label="Compact view" desc="Show more content with reduced spacing">
                    <Toggle on={prefs.compactView} onToggle={() => toggle(setPrefs, "compactView")} />
                  </SettingRow>
                  <SettingRow icon="🌐" label="Language" desc="Display language">
                    <select className="input" style={{ width: 140, appearance: "auto" }}>
                      <option>English (US)</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                    </select>
                  </SettingRow>
                </Section>

                <Section title="📊 Units & Format">
                  <SettingRow icon="⚖️" label="Metric units" desc="Use kg, cm, °C instead of lbs, in, °F">
                    <Toggle on={prefs.metricUnits} onToggle={() => toggle(setPrefs, "metricUnits")} />
                  </SettingRow>
                  <SettingRow icon="🕐" label="Time format" desc="12-hour or 24-hour clock">
                    <select className="input" style={{ width: 130, appearance: "auto" }}>
                      <option>12-hour (AM/PM)</option>
                      <option>24-hour</option>
                    </select>
                  </SettingRow>
                  <SettingRow icon="📅" label="Date format">
                    <select className="input" style={{ width: 150, appearance: "auto" }}>
                      <option>MM/DD/YYYY</option>
                      <option>DD/MM/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </SettingRow>
                </Section>

                <Section title="💊 Medication">
                  <SettingRow icon="📈" label="Show adherence score" desc="Display your medication adherence on the dashboard">
                    <Toggle on={prefs.showAdherence} onToggle={() => toggle(setPrefs, "showAdherence")} />
                  </SettingRow>
                  <SettingRow icon="🔄" label="Auto-refill reminders" desc="Automatically suggest refills based on pill count">
                    <Toggle on={prefs.autoRefill} onToggle={() => toggle(setPrefs, "autoRefill")} />
                  </SettingRow>
                </Section>
              </>
            )}

            {/* Account */}
            {activeSection === "account" && (
              <>
                <div className="card card-p" style={{
                  display: "flex", alignItems: "center", gap: 18, marginBottom: 4,
                  background: "linear-gradient(135deg, var(--brand-50) 0%, white 100%)",
                  border: "1px solid var(--brand-100)",
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%",
                    background: "var(--brand-100)", color: "var(--brand-700)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-display)", fontSize: 22, flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--n-900)" }}>{name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{email}</div>
                    <div style={{ fontSize: 12, color: "var(--brand-600)", marginTop: 3, fontWeight: 600 }}>
                      Free account · Member since {memberSince}
                    </div>
                  </div>
                  <Link href="/profile" style={{ marginLeft: "auto" }}>
                    <button className="btn btn-secondary btn-sm">Edit profile →</button>
                  </Link>
                </div>

                <Section title="👤 Account Management">
                  <SettingRow icon="✉️" label="Email address" desc={email}>
                    <Link href="/profile"><button className="btn btn-secondary btn-sm">Change →</button></Link>
                  </SettingRow>
                  <SettingRow icon="📱" label="Phone number" desc={phone}>
                    <Link href="/profile"><button className="btn btn-secondary btn-sm">Update →</button></Link>
                  </SettingRow>
                  <SettingRow icon="🩺" label="Primary care provider" desc={doctor}>
                    <Link href="/profile"><button className="btn btn-secondary btn-sm">Change →</button></Link>
                  </SettingRow>
                </Section>

                <Section title="⚠️ Danger Zone">
                  <SettingRow icon="📥" label="Download my data" desc="Get a copy of all your health data in JSON or CSV format">
                    <button className="btn btn-secondary btn-sm" onClick={() => alert("Downloading health package...")}>Download →</button>
                  </SettingRow>
                  <SettingRow icon="🗑️" label="Delete account" desc="Permanently delete your account and all health data">
                    <button className="btn btn-danger btn-sm" onClick={() => alert("Account deletion request is disabled for demo.")}>Delete →</button>
                  </SettingRow>
                </Section>
              </>
            )}

            {/* Data & Export */}
            {activeSection === "data" && (
              <>
                <Section title="📊 Export Your Data">
                  <SettingRow icon="💊" label="Medication history" desc="All medication logs and adherence records">
                    <button className="btn btn-secondary btn-sm" onClick={() => alert("Exported prescription CSV!")}>Export CSV</button>
                  </SettingRow>
                  <SettingRow icon="🩺" label="Health metrics" desc="All recorded vitals and measurements">
                    <button className="btn btn-secondary btn-sm" onClick={() => alert("Exported metrics CSV!")}>Export CSV</button>
                  </SettingRow>
                  <SettingRow icon="📋" label="Full health report" desc="Complete health summary as PDF">
                    <button className="btn btn-secondary btn-sm" onClick={() => alert("Compiled medical report PDF!")}>Export PDF</button>
                  </SettingRow>
                </Section>

                <Section title="🔄 Integrations">
                  {[
                    { name: "Apple Health", icon: "🍎", status: "connected" },
                    { name: "Google Fit", icon: "🔵", status: "disconnected" },
                    { name: "Fitbit", icon: "⌚", status: "disconnected" },
                    { name: "Garmin Connect", icon: "🏃", status: "disconnected" },
                  ].map((app) => (
                    <SettingRow key={app.name} icon={app.icon} label={app.name}
                      desc={app.status === "connected" ? "Connected and syncing" : "Not connected"}>
                      <button className={`btn btn-sm ${app.status === "connected" ? "btn-danger" : "btn-secondary"}`} onClick={() => alert("Integration settings locked for demo.")}>
                        {app.status === "connected" ? "Disconnect" : "Connect"}
                      </button>
                    </SettingRow>
                  ))}
                </Section>
              </>
            )}

            {/* About */}
            {activeSection === "about" && (
              <Section title="ℹ️ About MediTrack">
                <SettingRow icon="📱" label="App version" desc="Current release">
                  <span style={{ fontSize: 13, color: "var(--n-500)", fontWeight: 600 }}>v2.4.1</span>
                </SettingRow>
                <SettingRow icon="📝" label="Terms of Service" desc="Read our terms and conditions">
                  <button className="btn btn-ghost btn-sm" onClick={() => alert("HIPAA Terms of Service document is locked for demo.")}>Read →</button>
                </SettingRow>
                <SettingRow icon="🔒" label="Privacy Policy" desc="How we handle your health data">
                  <button className="btn btn-ghost btn-sm" onClick={() => alert("Privacy policy document is locked for demo.")}>Read →</button>
                </SettingRow>
                <SettingRow icon="💬" label="Contact support" desc="Get help from our team">
                  <button className="btn btn-secondary btn-sm" onClick={() => alert("Support ticket opened! We will get in touch.")}>Contact →</button>
                </SettingRow>
                <SettingRow icon="⭐" label="Rate MediTrack" desc="Leave a review on the App Store">
                  <button className="btn btn-secondary btn-sm" onClick={() => alert("Thank you for your rating!")}>Rate →</button>
                </SettingRow>
                <div style={{ padding: "20px 0 8px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--n-700)", marginBottom: 4 }}>
                    Medi<em style={{ color: "var(--brand-500)" }}>Track</em>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--n-400)" }}>
                    Premium healthcare management · HIPAA compliant · 256-bit encrypted
                  </div>
                </div>
              </Section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}