"use client";
// src/app/(auth)/register/page.tsx
//
// CHANGES FROM PREVIOUS VERSION
// ───────────────────────────────
// 1. "use client" — the form needs state and a submit handler.
// 2. handleSubmit() calls POST /api/auth/register (or login) and sets cookie.
//    Stubbed with the same fake-user approach as login; swap for real DB later.
// 3. No <Link href="/dashboard"> wrapping the button — that pattern is what
//    caused the login redirect loop and must not be replicated here.
// 4. Color improvements: better contrast on labels, muted text, border tones,
//    stronger brand palette on feature cards, richer left-panel feel.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const features = [
  { icon: "📊", title: "Vital Monitoring",    desc: "Track heart rate, BP, glucose, and more in real time." },
  { icon: "💊", title: "Medication Manager",  desc: "Smart reminders, refill alerts, and interaction checks." },
  { icon: "🔬", title: "Lab Result Tracking", desc: "Securely store and share your lab history with doctors." },
];

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [dob,       setDob]       = useState("");
  const [password,  setPassword]  = useState("");
  const [provider,  setProvider]  = useState("");
  const [agreed,    setAgreed]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Password strength (simple heuristic — good enough for mock)
  const pwStrength =
    password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4
    : 3;

  const strengthLabel  = ["", "Weak", "Fair", "Good", "Strong"][pwStrength];
  const strengthColor  = ["", "var(--danger)", "var(--warning)", "var(--info)", "var(--success)"][pwStrength];
  const strengthWidth  = ["0%", "25%", "50%", "75%", "100%"][pwStrength];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (!agreed) { setError("Please accept the Terms of Service to continue."); return; }

    setError(null);
    setLoading(true);

    try {
      // ── Registration API call ─────────────────────────────────────────────
      const res = await fetch("/api/auth/register", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email: email.trim().toLowerCase(),
          password
        }),
      });

      let data: { success: boolean; error?: { message: string } };
      try { data = await res.json(); }
      catch { setError("Unexpected server response."); return; }

      if (!res.ok || !data.success) {
        setError(data.error?.message ?? "Registration failed. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="auth-panel">
        <div style={{ position: "relative", zIndex: 1 }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 52 }}>
            <div style={{
              width: 36, height: 36,
              background: "rgba(255,255,255,.22)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 17,
            }}>✚</div>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 21,
              color: "white", letterSpacing: "-.01em",
            }}>
              Medi<em>Track</em>
            </span>
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 40, color: "white",
            lineHeight: 1.15, letterSpacing: "-.03em", marginBottom: 18,
          }}>
            Start your<br />health journey<br /><em>today.</em>
          </h2>
          <p style={{
            color: "rgba(255,255,255,.6)", fontSize: 15,
            lineHeight: 1.8, maxWidth: 340, marginBottom: 36,
          }}>
            Join 50,000+ patients taking control of their health with MediTrack's comprehensive platform.
          </p>

          {/* Feature cards */}
          {features.map(f => (
            <div key={f.title} style={{
              display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14,
              padding: "14px 16px",
              background: "rgba(255,255,255,.07)",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.1)",
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
              <div>
                <div style={{ color: "white", fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
                  {f.title}
                </div>
                <div style={{ color: "rgba(255,255,255,.52)", fontSize: 13, lineHeight: 1.55 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", lineHeight: 1.6 }}>
            Free forever for individuals · No credit card required.
          </p>
        </div>
      </div>

      {/* ── Right form ─────────────────────────────────────────────────── */}
      <div className="auth-form-side">
        <div className="auth-form-box anim-fade-up">

          <div style={{ marginBottom: 28 }}>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: 28,
              color: "var(--n-900)", letterSpacing: "-.025em", marginBottom: 6,
            }}>Create your account</h1>
            <p style={{ fontSize: 13.5, color: "var(--n-500)" }}>
              Free to use · No credit card needed
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              marginBottom: 18, padding: "12px 16px",
              background: "var(--danger-bg)",
              border: "1px solid var(--danger-border)",
              borderRadius: "var(--r-sm)",
              display: "flex", gap: 10, alignItems: "flex-start",
              fontSize: 13.5, color: "var(--danger)", lineHeight: 1.5,
            }}>
              <span style={{ flexShrink: 0, fontSize: 15 }}>⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 15 }}>

            {/* Name row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <label className="field-label" htmlFor="reg-first">First Name</label>
                <input
                  id="reg-first"
                  type="text"
                  className="input"
                  placeholder="Alex"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="reg-last">Last Name</label>
                <input
                  id="reg-last"
                  type="text"
                  className="input"
                  placeholder="Johnson"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="reg-email">Email address</label>
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
                  id="reg-email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Date of birth */}
            <div className="field">
              <label className="field-label" htmlFor="reg-dob">Date of Birth</label>
              <input
                id="reg-dob"
                type="date"
                className="input"
                value={dob}
                onChange={e => setDob(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="reg-password">Password</label>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="reg-password"
                  type="password"
                  className="input"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password strength meter */}
            {password.length > 0 && (
              <div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: "var(--n-500)", marginBottom: 5,
                }}>
                  <span>Password strength</span>
                  <span style={{ color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span>
                </div>
                <div className="progress" style={{ height: 5 }}>
                  <div
                    className="progress-bar"
                    style={{ width: strengthWidth, background: strengthColor, transition: "width .3s, background .3s" }}
                  />
                </div>
              </div>
            )}

            {/* Primary care provider */}
            <div className="field">
              <label className="field-label" htmlFor="reg-provider">Primary care provider (optional)</label>
              <input
                id="reg-provider"
                type="text"
                className="input"
                placeholder="Dr. Smith — General Practice"
                value={provider}
                onChange={e => setProvider(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Terms */}
            <label style={{
              display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
              padding: "10px 13px",
              background: agreed ? "var(--success-bg)" : "var(--n-50)",
              borderRadius: "var(--r-sm)",
              border: `1.5px solid ${agreed ? "var(--success-border)" : "var(--border)"}`,
              fontSize: 13, color: "var(--n-600)",
              transition: "background .2s, border-color .2s",
              userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ accentColor: "var(--brand-500)", marginTop: 2, flexShrink: 0 }}
                disabled={loading}
              />
              <span>
                I agree to the{" "}
                <a href="#" style={{ color: "var(--brand-600)", fontWeight: 600 }}>Terms of Service</a>
                {" "}and{" "}
                <a href="#" style={{ color: "var(--brand-600)", fontWeight: 600 }}>Privacy Policy</a>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", gap: 10, opacity: loading ? .8 : 1 }}
              disabled={loading || !agreed}
            >
              {loading && (
                <span style={{
                  display: "inline-block",
                  width: 16, height: 16,
                  border: "2px solid rgba(255,255,255,.35)",
                  borderTopColor: "white",
                  borderRadius: "50%",
                  animation: "spin .65s linear infinite",
                  flexShrink: 0,
                }} />
              )}
              {loading ? "Creating account…" : "Create my MediTrack account"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--n-400)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Social */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["🍎", "Apple"], ["🔵", "Google"]].map(([icon, name]) => (
              <button key={name} type="button" className="btn btn-secondary" style={{ justifyContent: "center" }}>
                {icon} {name}
              </button>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--n-500)", marginTop: 20 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--brand-600)", fontWeight: 700 }}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}