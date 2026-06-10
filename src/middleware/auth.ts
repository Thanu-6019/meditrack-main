// src/middleware/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Middleware-layer auth helper.
//
// IMPORTANT — runs in the Next.js Edge Runtime (middleware.ts context).
// This means:
//   ✗  No Node.js built-ins (fs, crypto, path)
//   ✗  No Mongoose / MongoDB
//   ✗  No bcrypt
//   ✓  Web Crypto API available
//   ✓  next/server (NextRequest, NextResponse)
//
// We use `jose` here (not `jsonwebtoken`) because jose is Edge-compatible.
// `jsonwebtoken` uses Node.js crypto and will crash in the Edge runtime.
// ─────────────────────────────────────────────────────────────────────────────

import { jwtVerify, type JWTPayload } from "jose";
import type { NextRequest } from "next/server";

// ─── Cookie name (must match lib/auth.ts) ────────────────────────────────────
export const COOKIE_ACCESS  = "meditrack_access";
export const COOKIE_REFRESH = "meditrack_refresh";

// ─── Payload shape ────────────────────────────────────────────────────────────

export interface MiddlewareTokenPayload extends JWTPayload {
  userId: string;
  email:  string;
  type:   "access";
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type MiddlewareAuthResult =
  | { valid: true;  payload: MiddlewareTokenPayload }
  | { valid: false; reason: "missing" | "expired" | "invalid" };

// ─── Secret resolution ───────────────────────────────────────────────────────

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    // This will surface as a 500 in dev if you forget to set the env var
    throw new Error("JWT_ACCESS_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

// ─── Core verification ────────────────────────────────────────────────────────

/**
 * Extracts the access token from the incoming request cookies and verifies it.
 *
 * Returns a discriminated union — callers must handle both branches:
 *
 * ```ts
 * const auth = await verifyMiddlewareToken(request);
 * if (!auth.valid) { // redirect or 401 }
 * const { userId, email } = auth.payload;
 * ```
 */
export async function verifyMiddlewareToken(
  request: NextRequest
): Promise<MiddlewareAuthResult> {
  // 1. Extract raw token string from cookie jar
  const token = request.cookies.get(COOKIE_ACCESS)?.value;

  if (!token || token.trim() === "") {
    return { valid: false, reason: "missing" };
  }

  // 2. Verify signature + expiry using jose (Edge-compatible)
  try {
    const { payload } = await jwtVerify(token, getAccessSecret(), {
      algorithms: ["HS256"],
    });

    const typed = payload as MiddlewareTokenPayload;

    // 3. Guard against a refresh token being passed as an access token
    if (typed.type !== "access") {
      return { valid: false, reason: "invalid" };
    }

    // 4. Ensure required claims are present (belt-and-suspenders)
    if (!typed.userId || !typed.email) {
      return { valid: false, reason: "invalid" };
    }

    return { valid: true, payload: typed };
  } catch (err) {
    // jose throws named errors — map them to our simpler union
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err
    ) {
      const code = (err as { code: string }).code;
      if (code === "ERR_JWT_EXPIRED") {
        return { valid: false, reason: "expired" };
      }
    }
    return { valid: false, reason: "invalid" };
  }
}

// ─── Request header injection ─────────────────────────────────────────────────

/**
 * Returns a headers object with userId + email injected.
 * Used by middleware to forward identity to Route Handlers without a DB call.
 *
 * Route Handlers then read these via:
 *   request.headers.get("x-user-id")
 *   request.headers.get("x-user-email")
 */
export function buildAuthHeaders(
  payload: MiddlewareTokenPayload
): Record<string, string> {
  return {
    "x-user-id":    payload.userId,
    "x-user-email": payload.email,
  };
}