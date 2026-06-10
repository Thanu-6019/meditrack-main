// src/lib/auth-context.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side auth context helpers.
//
// These run in the Node.js runtime (Route Handlers, Server Components, Server
// Actions) — NOT in the Edge middleware.  That means full DB access is fine.
//
// HOW IDENTITY FLOWS THROUGH THE STACK
// ──────────────────────────────────────
//  1. Middleware verifies the JWT (Edge, no DB)
//  2. Middleware injects x-user-id + x-user-email headers into the request
//  3. Route Handlers read those headers — no re-verification needed
//  4. If they need the full User document they call getUserFromRequest()
//     which does ONE DB lookup
//
// This design keeps the hot path (most API calls) to zero extra DB round-trips.
// ─────────────────────────────────────────────────────────────────────────────

import { type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import connectDB from "./mongodb";
import User, { type IUser } from "@/models/User";
import { verifyAccessToken } from "./jwt";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal identity — always available from the JWT without a DB call. */
export interface RequestIdentity {
  userId: string;
  email:  string;
}

/**
 * Safe public user shape — never includes password or refreshToken.
 * Returned when callers need the full user document.
 */
export interface SafeUser {
  id:            string;
  name:          string;
  email:         string;
  age:           number | null;
  gender:        string | null;
  phone:         string | null;
  dateOfBirth:   Date   | null;
  healthProfile: IUser["healthProfile"];
  isActive:      boolean;
  lastLogin:     Date   | null;
  createdAt:     Date;
  updatedAt:     Date;
}

export type ContextResult<T> =
  | { ok: true;  data: T }
  | { ok: false; reason: "unauthenticated" | "user_not_found" | "account_disabled" };

// ─── Route Handler helpers (NextRequest) ──────────────────────────────────────

/**
 * Reads identity from the headers injected by middleware.
 * Zero DB calls — use this when you only need userId/email.
 *
 * ```ts
 * // In a Route Handler:
 * const identity = getIdentityFromRequest(request);
 * if (!identity.ok) return unauthorizedResponse(identity.reason);
 * const { userId } = identity.data;
 * ```
 */
export function getIdentityFromRequest(
  request: NextRequest
): ContextResult<RequestIdentity> {
  const userId = request.headers.get("x-user-id");
  const email  = request.headers.get("x-user-email");

  if (!userId || !email) {
    // Headers not present — request didn't pass through auth middleware
    // (shouldn't happen for protected routes, but be defensive)
    return { ok: false, reason: "unauthenticated" };
  }

  return { ok: true, data: { userId, email } };
}

/**
 * Returns the full User document for the requester.
 * Makes ONE DB call. Use when you need profile data beyond userId/email.
 *
 * ```ts
 * const result = await getUserFromRequest(request);
 * if (!result.ok) return unauthorizedResponse(result.reason);
 * const user = result.data; // SafeUser
 * ```
 */
export async function getUserFromRequest(
  request: NextRequest
): Promise<ContextResult<SafeUser>> {
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return identity;

  return fetchSafeUser(identity.data.userId);
}

// ─── Server Component / Server Action helpers ─────────────────────────────────

/**
 * Reads identity from Server Component headers (injected by middleware).
 * Use inside `async` Server Components or Server Actions.
 *
 * ```ts
 * const identity = await getIdentityFromHeaders();
 * if (!identity.ok) redirect("/login");
 * ```
 */
export async function getIdentityFromHeaders(): Promise<ContextResult<RequestIdentity>> {
  const headerStore = await headers();
  const userId = headerStore.get("x-user-id");
  const email  = headerStore.get("x-user-email");

  if (!userId || !email) {
    return { ok: false, reason: "unauthenticated" };
  }

  return { ok: true, data: { userId, email } };
}

/**
 * Full user fetch for Server Components.
 * Falls back to cookie-based JWT verification if headers are absent
 * (handles edge cases like direct SSR without middleware e.g. `next start` cold boot).
 *
 * ```ts
 * const result = await getServerUser();
 * if (!result.ok) redirect("/login");
 * const { name, email } = result.data;
 * ```
 */
export async function getServerUser(): Promise<ContextResult<SafeUser>> {
  // 1. Try fast path — headers injected by middleware
  const identity = await getIdentityFromHeaders();

  if (identity.ok) {
    return fetchSafeUser(identity.data.userId);
  }

  // 2. Fallback — read cookie directly (Server Component context)
  const cookieStore = await cookies();
  const token = cookieStore.get("meditrack_access")?.value;

  if (!token) {
    return { ok: false, reason: "unauthenticated" };
  }

  const result = verifyAccessToken(token);
  if (!result.ok) {
    return { ok: false, reason: "unauthenticated" };
  }

  return fetchSafeUser(result.payload.userId);
}

// ─── Shared DB fetch ──────────────────────────────────────────────────────────

async function fetchSafeUser(userId: string): Promise<ContextResult<SafeUser>> {
  try {
    await connectDB();

    const user = await User.findById(userId)
      .select("-password -refreshToken -__v")
      .lean<IUser>();

    if (!user) {
      return { ok: false, reason: "user_not_found" };
    }

    if (!user.isActive) {
      return { ok: false, reason: "account_disabled" };
    }

    return {
      ok:   true,
      data: {
        id:            user._id.toString(),
        name:          user.name,
        email:         user.email,
        age:           user.age   ?? null,
        gender:        user.gender ?? null,
        phone:         user.phone  ?? null,
        dateOfBirth:   user.dateOfBirth ?? null,
        healthProfile: user.healthProfile,
        isActive:      user.isActive,
        lastLogin:     user.lastLogin  ?? null,
        createdAt:     user.createdAt,
        updatedAt:     user.updatedAt,
      },
    };
  } catch (err) {
    console.error("[auth-context] fetchSafeUser error:", err);
    // Surface as unauthenticated — don't leak internal errors to callers
    return { ok: false, reason: "unauthenticated" };
  }
}

// ─── Context-error → HTTP response mapper ────────────────────────────────────

/**
 * Maps a failed ContextResult reason to the appropriate HTTP status + message.
 * Convenient for Route Handlers that want to return a standardised response.
 *
 * ```ts
 * const result = await getUserFromRequest(request);
 * if (!result.ok) return contextErrorToResponse(result.reason);
 * ```
 */
export function contextErrorToResponse(
  reason: "unauthenticated" | "user_not_found" | "account_disabled"
): Response {
  const map = {
    unauthenticated: {
      status:  401,
      message: "Authentication required",
      code:    "UNAUTHORIZED",
    },
    user_not_found: {
      status:  401,
      message: "User account not found",
      code:    "USER_NOT_FOUND",
    },
    account_disabled: {
      status:  403,
      message: "Your account has been disabled",
      code:    "ACCOUNT_DISABLED",
    },
  } as const;

  const { status, message, code } = map[reason];

  return Response.json(
    { success: false, error: { message, code } },
    { status }
  );
}