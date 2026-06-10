// src/lib/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers — password hashing, cookie management, request authentication.
//
// COOKIE ARCHITECTURE
// ───────────────────
//  meditrack_access   httpOnly, Secure, SameSite=Lax, maxAge=15m
//  meditrack_refresh  httpOnly, Secure, SameSite=Lax, maxAge=7d, path=/api/auth/refresh
//
// Setting `path=/api/auth/refresh` on the refresh cookie means it is ONLY
// sent to that one endpoint — all other routes never see it, limiting exposure.
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  type AccessTokenPayload,
} from "./jwt";

// ─── Constants ────────────────────────────────────────────────────────────────

export const COOKIE_ACCESS  = "meditrack_access";
export const COOKIE_REFRESH = "meditrack_refresh";

const IS_PROD = process.env.NODE_ENV === "production";

const ACCESS_MAX_AGE  = 15 * 60;           // 15 minutes (seconds)
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days (seconds)

// ─── Password utilities ───────────────────────────────────────────────────────

const SALT_ROUNDS = 12; // bcrypt work factor — increase for higher security, slower hashing

/**
 * Returns a bcrypt hash of the provided plain-text password.
 * Never store the raw password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Returns true if they match, false otherwise.
 * Uses bcrypt.compare which is timing-safe.
 */
export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/**
 * Sets both the access and refresh token cookies on a NextResponse.
 * Call this after a successful login or register.
 */
export function setAuthCookies(
  response: NextResponse,
  userId: string,
  email: string
): void {
  const accessToken  = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId);

  // Access token cookie — sent to every route
  response.cookies.set(COOKIE_ACCESS, accessToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    maxAge:   ACCESS_MAX_AGE,
    path:     "/",
  });

  // Refresh token cookie — ONLY sent to /api/auth/refresh
  response.cookies.set(COOKIE_REFRESH, refreshToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    maxAge:   REFRESH_MAX_AGE,
    path:     "/api/auth/refresh", // scoped path — key security measure
  });
}

/**
 * Clears both auth cookies (sets maxAge=0).
 * Call this on logout.
 */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(COOKIE_ACCESS, "", {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    maxAge:   0,
    path:     "/",
  });

  response.cookies.set(COOKIE_REFRESH, "", {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    maxAge:   0,
    path:     "/api/auth/refresh",
  });
}

/**
 * Sets ONLY the access token cookie (used by the /refresh endpoint).
 */
export function setAccessCookie(response: NextResponse, userId: string, email: string): void {
  const accessToken = generateAccessToken(userId, email);

  response.cookies.set(COOKIE_ACCESS, accessToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax",
    maxAge:   ACCESS_MAX_AGE,
    path:     "/",
  });
}

// ─── Request authentication ───────────────────────────────────────────────────

export type AuthResult =
  | { authenticated: true;  user: AccessTokenPayload }
  | { authenticated: false; reason: string };

/**
 * Extracts and verifies the access token from an incoming NextRequest.
 *
 * Usage in a Route Handler:
 * ```ts
 * const auth = getAuthFromRequest(request);
 * if (!auth.authenticated) return unauthorizedResponse(auth.reason);
 * const { userId, email } = auth.user;
 * ```
 */
export function getAuthFromRequest(request: NextRequest): AuthResult {
  const token = request.cookies.get(COOKIE_ACCESS)?.value;

  if (!token) {
    return { authenticated: false, reason: "No access token" };
  }

  const result = verifyAccessToken(token);

  if (!result.ok) {
    return {
      authenticated: false,
      reason: result.error === "expired" ? "Access token expired" : "Invalid access token",
    };
  }

  return { authenticated: true, user: result.payload };
}

/**
 * Extracts and verifies the access token from the Next.js cookies() store.
 * Use this in Server Components and Server Actions (not Route Handlers).
 *
 * ```ts
 * const auth = await getAuthFromCookies();
 * ```
 */
export async function getAuthFromCookies(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_ACCESS)?.value;

  if (!token) {
    return { authenticated: false, reason: "No access token" };
  }

  const result = verifyAccessToken(token);

  if (!result.ok) {
    return {
      authenticated: false,
      reason: result.error === "expired" ? "Access token expired" : "Invalid access token",
    };
  }

  return { authenticated: true, user: result.payload };
}

// ─── Standard error responses ─────────────────────────────────────────────────

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json(
    { success: false, error: { message, code: "UNAUTHORIZED" } },
    { status: 401 }
  );
}

export function badRequestResponse(message: string, code = "BAD_REQUEST"): NextResponse {
  return NextResponse.json(
    { success: false, error: { message, code } },
    { status: 400 }
  );
}

export function serverErrorResponse(message = "Internal server error"): NextResponse {
  return NextResponse.json(
    { success: false, error: { message, code: "SERVER_ERROR" } },
    { status: 500 }
  );
}