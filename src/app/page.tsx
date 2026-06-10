// src/app/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Root page — intentional no-op.
//
// The middleware intercepts every request to "/" before this component
// renders and redirects to /dashboard (authenticated) or /login
// (unauthenticated). This file is therefore never reached in normal flow.
//
// IMPORTANT: Do NOT put redirect() here.
// A redirect() in a Server Component runs AFTER the middleware redirect
// has already been issued. In some Next.js 15 builds this causes the
// response pipeline to issue two redirects for the same request, which
// is what produces the "repeated GET /" entries in the crash log.
// ─────────────────────────────────────────────────────────────────────────────
export default function RootPage() {
  return null;
}