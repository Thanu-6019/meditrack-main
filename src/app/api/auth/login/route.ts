// src/app/api/auth/login/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
//
// Body: { email, password }
//
// Flow:
//  1. Validate input
//  2. Find user by email (with password selected back in)
//  3. Compare password
//  4. Update lastLogin timestamp
//  5. Issue JWT cookies
//  6. Return sanitised user object
//
// SECURITY NOTE:
//   We return the SAME error message for "email not found" and "wrong password"
//   to prevent user enumeration attacks (attacker cannot tell which accounts exist).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  comparePassword,
  setAuthCookies,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/auth";

// ─── Input validation ─────────────────────────────────────────────────────────

interface LoginBody {
  email:    string;
  password: string;
}

function validateLoginInput(body: Partial<LoginBody>): string | null {
  if (!body.email?.trim())  return "Email is required";
  if (!body.password)       return "Password is required";
  return null;
}

// Unified error to prevent user enumeration
const INVALID_CREDENTIALS_RESPONSE = NextResponse.json(
  {
    success: false,
    error: {
      message: "Invalid email or password",
      code:    "INVALID_CREDENTIALS",
    },
  },
  { status: 401 }
);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: Partial<LoginBody>;
  try {
    body = (await request.json()) as Partial<LoginBody>;
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  // 2. Validate input
  const validationError = validateLoginInput(body);
  if (validationError) {
    return badRequestResponse(validationError, "VALIDATION_ERROR");
  }

  const email    = body.email!.trim().toLowerCase();
  const password = body.password!;

  try {
    await connectDB();

    // 3. Find user — must re-add `password` since it has select:false on the schema
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      // Consistent timing — run bcrypt even on missing user to prevent
      // timing-based enumeration (attacker can't tell no-user vs wrong-password)
      await comparePassword(password, "$2b$12$placeholderHashToPreventTimingAttack");
      return INVALID_CREDENTIALS_RESPONSE;
    }

    // 4. Compare password
    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return INVALID_CREDENTIALS_RESPONSE;
    }

    // 5. Update last login timestamp (non-blocking — don't await on hot path)
    User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).exec().catch(() => {
      // Non-critical — log but don't fail the login
      console.warn("[login] Failed to update lastLogin for user:", user._id);
    });

    // 6. Build sanitised response
    const safeUser = {
      id:        user._id.toString(),
      name:      user.name,
      email:     user.email,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      data:    { user: safeUser },
    });

    setAuthCookies(response, safeUser.id, safeUser.email);

    return response;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return serverErrorResponse();
  }
}