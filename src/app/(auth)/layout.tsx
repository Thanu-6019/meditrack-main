// src/app/(auth)/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Layout for the auth route group: /login, /register, /forgot-password.
//
// This layout is intentionally minimal — auth pages manage their own
// full-viewport styling via the .auth-shell / .auth-panel / .auth-form-side
// classes defined in globals.css.
//
// What this layout does NOT include:
//   • Sidebar — authenticated-only; lives in (protected)/layout.tsx.
//   • Redirect logic — middleware handles that before this renders.
//   • Any wrapping div — auth pages fill 100 vh themselves.
//
// The route group folder name "(auth)" is a Next.js convention: the parentheses
// mean this segment does NOT appear in the URL. All three pages sit directly
// at /login, /register, and /forgot-password, not at /auth/login etc.
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No chrome needed — auth pages are self-contained full-screen layouts.
  return <>{children}</>;
}