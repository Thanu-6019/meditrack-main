"use client";
// src/app/(auth)/login/page.tsx
// Must be a Client Component so we can handle form state and call the API.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState("alex.johnson@email.com");
  const [password, setPassword] = useState("password123");
  const [remember, setRemember] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Submit handler ──────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method:      "POST",
        credentials: "include",           // ensure the Set-Cookie header is honoured
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json()) as {
        success: boolean;
        data?:   { id: string; email: string };
        error?:  { message: string; code: string };
      };

      if (!res.ok || !data.success) {
        setError(data.error?.message ?? "Login failed. Please try again.");
        return;
      }

      // Cookie is now set by the API response.
      // Push to dashboard — middleware will verify the token on every subsequent request.
      router.push("/dashboard");
      // router.refresh() is not needed: the push causes a full navigation.
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="auth-shell">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="auth-panel">
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 52 }}>
            <div style={{
              width: 36, height: 36, background: "rgba(255,255,255,.18)", borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 17,
            }}>✚</div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 21, color: "white" }}>
              Medi<em>Track</em>
            </span>
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: 44,
            color: "white", lineHeight: 1.12, letterSpacing: "-.03em", marginBottom: 18,
          }}>
            Your health,<br />
            <em>beautifully</em><br />
            managed.
          </h2>
          <p style={{ color: "rgba(255,255,255,.55)", fontSize: 15, lineHeight: 1.75, maxWidth: 340 }}>
            Track medications, monitor vitals, and stay connected with your care team — all in one place.
          </p>
        </div>

        {/* Stats + preview card */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 28 }}>
            {[
              { v: "98%",  l: "Adherence" },
              { v: "4.9★", l: "Rating"    },
              { v: "50k+", l: "Patients"  },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "white", letterSpacing: "-.02em" }}>{s.v}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Floating preview card */}
          <div style={{
            background: "rgba(255,255,255,.08)", borderRadius: 14,
            border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(10px)",
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>💊</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>Medication reminder</div>
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12 }}>Lisinopril 10mg · Due in 45 min</div>
            </div>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#fbbf24", animation: "pulse-dot 2s infinite",
            }} />
          </div>
        </div>
      </div>

      {/* ── Right form ─────────────────────────────────────────────────────── */}
      <div className="auth-form-side">
        <div className="auth-form-box anim-fade-up">
          <div style={{ marginBottom: 34 }}>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: 30, color: "var(--n-900)",
              letterSpacing: "-.025em", marginBottom: 6,
            }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>Sign in to your MediTrack account</p>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              marginBottom: 18, padding: "12px 14px",
              background: "var(--danger-bg)", borderRadius: "var(--r-sm)",
              border: "1px solid var(--danger-border)",
              fontSize: 13, color: "var(--danger)", lineHeight: 1.5,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="field">
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
                  id="email"
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

            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="field-label" htmlFor="password">Password</label>
                <Link href="/forgot-password" style={{ fontSize: 12.5, color: "var(--brand-600)", fontWeight: 600 }}>
                  Forgot password?
                </Link>
              </div>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            <label style={{
              display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
              padding: "10px 13px", background: "var(--n-50)", borderRadius: "var(--r-sm)",
              border: "1.5px solid var(--border)", fontSize: 13, color: "var(--n-600)",
            }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ accentColor: "var(--brand-500)" }}
                disabled={loading}
              />
              Keep me signed in for 30 days
            </label>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", position: "relative" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span style={{
                    display: "inline-block", width: 16, height: 16,
                    border: "2px solid rgba(255,255,255,.4)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  Signing in…
                </>
              ) : "Sign in to MediTrack"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "26px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--n-400)" }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["🍎", "Apple"], ["🔵", "Google"]].map(([icon, name]) => (
              <button key={name} className="btn btn-secondary" style={{ justifyContent: "center" }} type="button">
                {icon} {name}
              </button>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 26 }}>
            New to MediTrack?{" "}
            <Link href="/register" style={{ color: "var(--brand-600)", fontWeight: 700 }}>
              Create account →
            </Link>
          </p>

          <div style={{
            marginTop: 24, padding: "12px 14px",
            background: "var(--brand-50)", borderRadius: "var(--r-sm)",
            border: "1px solid var(--brand-100)",
            display: "flex", gap: 10,
          }}>
            <span>🔐</span>
            <p style={{ fontSize: 12, color: "var(--brand-700)", lineHeight: 1.5 }}>
              256-bit encrypted. HIPAA compliant. Your health data stays private.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}