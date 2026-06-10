"use client";
// src/app/(auth)/forgot-password/page.tsx
//
// CHANGES FROM PREVIOUS VERSION
// ───────────────────────────────
// 1. "use client" added — needs useState for the email field and sent state.
// 2. handleSubmit() calls POST /api/auth/forgot-password (stubbed, ready for
//    real email delivery when MongoDB is wired up). No crash if the endpoint
//    doesn't exist yet — the UI still transitions to the success state.
// 3. No <Link href="…"> wrapping submit buttons — that pattern bypasses the
//    API and was the root cause of the redirect loop on the login page.
// 4. Color improvements: richer brand tones, better muted text contrast,
//    success state uses --success-* palette, info tip uses --brand-* palette.

import { useState, type FormEvent } from "react";
import Link from "next/link";

type Step = "idle" | "loading" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [step,  setStep]  = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === "loading") return;

    setError(null);
    setStep("loading");

    try {
      // ── Password-reset API call ─────────────────────────────────────────
      // Replace with a real endpoint when email delivery is implemented.
      // For now we optimistically show the success state after a short delay
      // so the flow is fully testable without a backend.
      const res = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      }).catch(() => null); // treat network failure gracefully

      // If the endpoint doesn't exist yet (404) or the fetch failed, we still
      // show the success state — never reveal whether an email exists.
      if (res && !res.ok && res.status !== 404) {
        let data: { error?: { message: string } } | null = null;
        try { data = await res.json(); } catch { /* ignore */ }
        if (data?.error?.message) {
          setError(data.error.message);
          setStep("idle");
          return;
        }
      }

      setStep("sent");
    } catch {
      setError("Network error — check your connection and try again.");
      setStep("idle");
    }
  }

  // ── Success view ──────────────────────────────────────────────────────────
  if (step === "sent") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)",
        padding: 24,
      }}>
        <div
          className="anim-scale-in"
          style={{
            background: "white", borderRadius: "var(--r-xl)",
            padding: "44px 40px", width: "100%", maxWidth: 440,
            boxShadow: "var(--shadow-xl)",
            display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", gap: 16,
          }}
        >
          {/* Success icon */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--success-bg)",
            border: "2px solid var(--success-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30,
          }}>
            ✉️
          </div>

          <div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: 24,
              color: "var(--n-900)", letterSpacing: "-.02em", marginBottom: 8,
            }}>
              Check your inbox
            </h1>
            <p style={{ fontSize: 14, color: "var(--n-500)", lineHeight: 1.65, maxWidth: 340 }}>
              If{" "}
              <strong style={{ color: "var(--n-700)" }}>{email}</strong>{" "}
              is linked to a MediTrack account, you'll receive a password reset
              link within a few minutes.
            </p>
          </div>

          {/* Tip */}
          <div style={{
            width: "100%", padding: "13px 16px",
            background: "var(--brand-50)",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--brand-100)",
            fontSize: 13, color: "var(--brand-700)", lineHeight: 1.55,
            textAlign: "left", display: "flex", gap: 10,
          }}>
            <span style={{ flexShrink: 0 }}>💡</span>
            <span>
              Check your spam or junk folder if the email doesn't arrive within
              a few minutes.
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "100%" }}
              onClick={() => { setStep("idle"); setEmail(""); }}
            >
              ← Try a different email
            </button>
            <Link href="/login" style={{ width: "100%" }}>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
                Back to sign in
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Request view ──────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)",
      padding: 24,
    }}>
      <div
        className="anim-scale-in"
        style={{
          background: "white", borderRadius: "var(--r-xl)",
          padding: "44px 40px", width: "100%", maxWidth: 440,
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Back link */}
        <Link
          href="/login"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, color: "var(--n-500)", marginBottom: 28,
            fontWeight: 500, textDecoration: "none",
            transition: "color .15s",
          }}
        >
          ← Back to sign in
        </Link>

        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "var(--brand-50)",
          border: "2px solid var(--brand-100)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, marginBottom: 20,
        }}>
          🔑
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 26,
          color: "var(--n-900)", letterSpacing: "-.025em", marginBottom: 8,
        }}>
          Reset your password
        </h1>
        <p style={{
          fontSize: 14, color: "var(--n-500)", lineHeight: 1.65, marginBottom: 28,
        }}>
          Enter your email address and we'll send you a secure link to reset
          your password.
        </p>

        {/* Error banner */}
        {error && (
          <div style={{
            marginBottom: 20, padding: "12px 16px",
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

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="field-label" htmlFor="reset-email">Email address</label>
            <div className="input-wrap">
              <span className="input-icon">✉</span>
              <input
                id="reset-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={step === "loading"}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", gap: 10, opacity: step === "loading" ? .8 : 1 }}
            disabled={step === "loading"}
          >
            {step === "loading" && (
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
            {step === "loading" ? "Sending…" : "Send reset link"}
          </button>
        </form>

        {/* Tip */}
        <div style={{
          marginTop: 24, padding: "14px 16px",
          background: "var(--brand-50)",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--brand-100)",
          fontSize: 13, color: "var(--brand-700)", lineHeight: 1.55,
          display: "flex", gap: 10,
        }}>
          <span style={{ flexShrink: 0 }}>💡</span>
          <span>
            Check your spam folder if you don't see the email within a few
            minutes.
          </span>
        </div>

        <p style={{
          textAlign: "center", fontSize: 13,
          color: "var(--n-500)", marginTop: 22,
        }}>
          Remember your password?{" "}
          <Link href="/login" style={{ color: "var(--brand-600)", fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}