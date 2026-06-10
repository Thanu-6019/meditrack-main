// src/middleware.ts  (must live at project root — next to /app)
// ─────────────────────────────────────────────────────────────────────────────
// Next.js Edge Middleware — runs BEFORE every matched request.
//
// ROUTE TABLE
// ──────────────────────────────────────────────────────────────────────────
//  Type            Path prefix              No token      Expired/invalid
//  ─────────────── ─────────────────────── ──────────────────────────────────
//  PUBLIC_ONLY     /login /register etc.   pass through  pass through
//  API_PROTECTED   /api/medicines etc.     401 JSON      401 JSON
//  PAGE_PROTECTED  /dashboard etc.         → /login      → /login
//  PUBLIC_API      /api/auth/*             pass through  pass through
//  EVERYTHING_ELSE anything else           pass through  pass through
//
// WHAT MIDDLEWARE DOES NOT DO:
//   ✗ DB calls (no Mongoose here — Edge Runtime)
//   ✗ bcrypt comparisons
//   ✗ Full user hydration
//
// It only verifies the JWT signature and injects identity headers.
// Route Handlers do the full DB fetch when they need it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { verifyMiddlewareToken, buildAuthHeaders } from "./middleware/auth";

// ─── Route classification ─────────────────────────────────────────────────────

/**
 * API routes that require a valid access token.
 * Matched by prefix — /api/medicines/123 is covered by "/api/medicines".
 */
const PROTECTED_API_PREFIXES: string[] = [
  "/api/medicines",
  "/api/health-metrics",
  "/api/notifications",
  "/api/profile",
  "/api/dashboard",
];

/**
 * Frontend page routes that require authentication.
 * An unauthenticated visit redirects to /login?callbackUrl=<original>.
 */
const PROTECTED_PAGE_PREFIXES: string[] = [
  "/dashboard",
  "/medicines",
  "/health-metrics",
  "/scanner",
  "/notifications",
  "/profile",
  "/settings",
  "/appointments",
  "/reports",
  "/ai-assistant",
];

/**
 * Auth routes the user should NOT reach while already logged in.
 * (Logged-in user visiting /login → redirect to /dashboard.)
 */
const PUBLIC_ONLY_ROUTES: string[] = [
  "/login",
  "/register",
  "/forgot-password",
];

// ─── Route classifier helpers ──────────────────────────────────────────────────

function isProtectedApi(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((p) =>
    pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isPublicOnly(pathname: string): boolean {
  return PUBLIC_ONLY_ROUTES.some((p) =>
    pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// ─── Standard responses ───────────────────────────────────────────────────────

function unauthorizedApiResponse(message: string, code: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { message, code } },
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function redirectToLogin(request: NextRequest, reason?: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  if (reason) loginUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(loginUrl);
}

function redirectToDashboard(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── 0. Always allow Next.js internals and static assets ──────────────────
  // (The matcher below already filters most of these, but be explicit.)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // ── 1. Verify token (non-blocking — token may simply be absent) ───────────
  const auth = await verifyMiddlewareToken(request);

  // ── 2. Root path redirect ─────────────────────────────────────────────────
  if (pathname === "/") {
    return auth.valid
      ? redirectToDashboard(request)
      : NextResponse.redirect(new URL("/login", request.url));
  }

  // ── 3. Public-only routes (login / register) ──────────────────────────────
  if (isPublicOnly(pathname)) {
    if (auth.valid) {
      // Already logged in — send to dashboard
      return redirectToDashboard(request);
    }
    return NextResponse.next();
  }

  // ── 4. Protected API routes ───────────────────────────────────────────────
  if (isProtectedApi(pathname)) {
    if (!auth.valid) {
      const message =
        auth.reason === "expired"
          ? "Access token expired — call /api/auth/refresh"
          : "Authentication required";
      const code =
        auth.reason === "expired" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
      return unauthorizedApiResponse(message, code);
    }

    // Inject identity headers so Route Handlers don't re-verify the token
    const requestHeaders = new Headers(request.headers);
    const authHeaders = buildAuthHeaders(auth.payload);
    Object.entries(authHeaders).forEach(([key, value]) => {
      requestHeaders.set(key, value);
    });

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── 5. Protected page routes ──────────────────────────────────────────────
  if (isProtectedPage(pathname)) {
    if (!auth.valid) {
      const reason = auth.reason === "expired" ? "session_expired" : undefined;
      return redirectToLogin(request, reason);
    }

    // Inject headers for Server Components that need user identity
    const requestHeaders = new Headers(request.headers);
    const authHeaders = buildAuthHeaders(auth.payload);
    Object.entries(authHeaders).forEach(([key, value]) => {
      requestHeaders.set(key, value);
    });

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── 6. Everything else — pass through ────────────────────────────────────
  return NextResponse.next();
}

// ─── Matcher ──────────────────────────────────────────────────────────────────
// Excludes static files and Next.js internals from middleware processing.
// This is a performance optimisation — middleware only runs where it's needed.

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public folder files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};