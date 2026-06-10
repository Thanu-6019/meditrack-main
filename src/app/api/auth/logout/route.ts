// src/app/api/auth/logout/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
//
// Flow:
//  1. Extract userId from access token (if present — don't block if expired)
//  2. Clear refreshToken stored in the database
//  3. Clear both auth cookies
//  4. Return 200
//
// DESIGN NOTE:
//   We attempt to clear the DB refresh token as a best-effort security measure
//   (prevents a stolen refresh token from being used after logout). If the
//   access token is expired/missing, we still clear the cookies — the user
//   should always be able to log out.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { clearAuthCookies, serverErrorResponse, COOKIE_ACCESS } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/jwt";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Try to identify the user — non-blocking (token may be expired)
    const accessToken = request.cookies.get(COOKIE_ACCESS)?.value;

    if (accessToken) {
      const result = verifyAccessToken(accessToken);

      if (result.ok) {
        // 2. Invalidate refresh token in DB (best-effort — fire and forget)
        connectDB()
          .then(() =>
            User.findByIdAndUpdate(result.payload.userId, {
              $unset: { refreshToken: "" },
            }).exec()
          )
          .catch((err) => {
            console.warn("[logout] Failed to clear refreshToken in DB:", err);
          });
      }
    }

    // 3. Always clear the cookies regardless of token state
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    clearAuthCookies(response);

    return response;
  } catch (err) {
    console.error("[POST /api/auth/logout]", err);

    // Even on error, attempt to clear cookies so the user isn't stuck
    const response = serverErrorResponse("Logout failed, but session cleared");
    clearAuthCookies(response);
    return response;
  }
}