// src/app/api/auth/refresh/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
//
// The browser sends the refresh cookie automatically because its path matches
// this exact endpoint: path=/api/auth/refresh
//
// Flow:
//  1. Read refresh token from cookie
//  2. Verify the token
//  3. Look up user (ensures account still exists + is active)
//  4. Validate the stored token matches (rotation guard)
//  5. Generate new access + refresh tokens (ROTATION)
//  6. Store new refresh token in DB
//  7. Set new cookies and return
//
// TOKEN ROTATION:
//   Each use of a refresh token invalidates it and issues a new one.
//   If an old token is replayed, it won't match the DB value — the session
//   is revoked immediately, protecting against token theft.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  setAuthCookies,
  unauthorizedResponse,
  serverErrorResponse,
  COOKIE_REFRESH,
} from "@/lib/auth";
import { verifyRefreshToken } from "@/lib/jwt";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read refresh token from cookie
  const refreshToken = request.cookies.get(COOKIE_REFRESH)?.value;

  if (!refreshToken) {
    return unauthorizedResponse("No refresh token provided");
  }

  // 2. Verify token signature and expiry
  const result = verifyRefreshToken(refreshToken);

  if (!result.ok) {
    return unauthorizedResponse(
      result.error === "expired"
        ? "Refresh token expired — please log in again"
        : "Invalid refresh token"
    );
  }

  const { userId } = result.payload;

  try {
    await connectDB();

    // 3. Look up user — re-add refreshToken (select:false on schema)
    const user = await User.findById(userId).select("+refreshToken");

    if (!user || !user.isActive) {
      return unauthorizedResponse("User not found or account disabled");
    }

    // 4. Token rotation guard — verify stored token matches the presented one
    //    If they differ, the token was already used → possible replay attack
    if (user.refreshToken !== refreshToken) {
      // Revoke the session entirely as a precaution
      await User.findByIdAndUpdate(userId, { $unset: { refreshToken: "" } });
      return unauthorizedResponse(
        "Refresh token already used — please log in again"
      );
    }

    // 5 + 6. Issue new tokens and store the new refresh token in DB
    //        (setAuthCookies generates the tokens; we then persist the refresh one)
    const response = NextResponse.json({
      success: true,
      message: "Token refreshed",
      data: {
        user: {
          id:    user._id.toString(),
          name:  user.name,
          email: user.email,
        },
      },
    });

    // Set cookies first so the tokens are generated
    setAuthCookies(response, user._id.toString(), user.email);

    // Persist the newly generated refresh token to DB so the next rotation check passes.
    // We read it back from the Set-Cookie header to avoid generating it twice.
    const newRefreshToken = response.cookies.get(COOKIE_REFRESH)?.value;

    if (newRefreshToken) {
      await User.findByIdAndUpdate(userId, { refreshToken: newRefreshToken });
    }

    return response;
  } catch (err) {
    console.error("[POST /api/auth/refresh]", err);
    return serverErrorResponse();
  }
}