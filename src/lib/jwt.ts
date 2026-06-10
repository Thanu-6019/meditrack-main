// src/lib/jwt.ts
// ─────────────────────────────────────────────────────────────────────────────
// JWT utilities — access + refresh token generation and verification.
//
// ACCESS TOKEN  (15 min)  — short-lived, sent with every API request via cookie
// REFRESH TOKEN (7 days)  — long-lived, used only to mint new access tokens
//
// Two separate secrets keep tokens non-interchangeable:
//   a stolen access token cannot be used as a refresh token and vice-versa.
// ─────────────────────────────────────────────────────────────────────────────

import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";

// ─── Environment ──────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Add it to .env.local — see README for the full list.`
    );
  }
  return value;
}

// Resolved lazily so Jest / test environments can set process.env before import
const getAccessSecret  = () => requireEnv("JWT_ACCESS_SECRET");
const getRefreshSecret = () => requireEnv("JWT_REFRESH_SECRET");

// ─── Payload shapes ───────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  email:  string;
  type:   "access";
}

export interface RefreshTokenPayload extends JwtPayload {
  userId: string;
  type:   "refresh";
}

// ─── Token generation ─────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token (15 min).
 * Includes userId + email so most API handlers never need a DB lookup.
 */
export function generateAccessToken(userId: string, email: string): string {
  const payload: Omit<AccessTokenPayload, "iat" | "exp"> = {
    userId,
    email,
    type: "access",
  };

  const options: SignOptions = {
    expiresIn: "15m",
    algorithm: "HS256",
  };

  return jwt.sign(payload, getAccessSecret(), options);
}

/**
 * Signs a long-lived refresh token (7 days).
 * Minimal payload — only userId to limit blast radius if intercepted.
 */
export function generateRefreshToken(userId: string): string {
  const payload: Omit<RefreshTokenPayload, "iat" | "exp"> = {
    userId,
    type: "refresh",
  };

  const options: SignOptions = {
    expiresIn: "7d",
    algorithm: "HS256",
  };

  return jwt.sign(payload, getRefreshSecret(), options);
}

// ─── Token verification ───────────────────────────────────────────────────────

export type VerifyResult<T> =
  | { ok: true;  payload: T }
  | { ok: false; error: "expired" | "invalid" };

/**
 * Verifies an access token.
 * Returns a discriminated union so callers are forced to handle failures.
 */
export function verifyAccessToken(token: string): VerifyResult<AccessTokenPayload> {
  try {
    const payload = jwt.verify(token, getAccessSecret()) as AccessTokenPayload;

    // Guard against a refresh token being passed here (type mismatch)
    if (payload.type !== "access") {
      return { ok: false, error: "invalid" };
    }

    return { ok: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { ok: false, error: "expired" };
    }
    return { ok: false, error: "invalid" };
  }
}

/**
 * Verifies a refresh token.
 */
export function verifyRefreshToken(token: string): VerifyResult<RefreshTokenPayload> {
  try {
    const payload = jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;

    if (payload.type !== "refresh") {
      return { ok: false, error: "invalid" };
    }

    return { ok: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { ok: false, error: "expired" };
    }
    return { ok: false, error: "invalid" };
  }
}

// ─── Convenience types re-exported for route handlers ────────────────────────
export type { JwtPayload };