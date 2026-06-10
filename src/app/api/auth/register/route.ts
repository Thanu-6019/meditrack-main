// src/app/api/auth/register/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
//
// Body: { name, email, password }
//
// Flow:
//  1. Validate input
//  2. Check for duplicate email
//  3. Hash password
//  4. Create user in MongoDB
//  5. Issue JWT cookies
//  6. Return sanitised user object (no password)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  hashPassword,
  setAuthCookies,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/auth";

// ─── Input validation ─────────────────────────────────────────────────────────

interface RegisterBody {
  name:     string;
  email:    string;
  password: string;
}

function validateRegisterInput(body: Partial<RegisterBody>): string | null {
  const { name, email, password } = body;

  if (!name?.trim())     return "Name is required";
  if (name.trim().length < 2) return "Name must be at least 2 characters";
  if (name.trim().length > 100) return "Name must be 100 characters or fewer";

  if (!email?.trim())    return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please provide a valid email address";
  }

  if (!password)         return "Password is required";
  if (password.length < 8)  return "Password must be at least 8 characters";
  if (password.length > 72) return "Password must be 72 characters or fewer"; // bcrypt limit

  // Basic strength check — at least one letter and one number
  if (!/[a-zA-Z]/.test(password)) return "Password must contain at least one letter";
  if (!/[0-9]/.test(password))    return "Password must contain at least one number";

  return null; // valid
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: Partial<RegisterBody>;
  try {
    body = (await request.json()) as Partial<RegisterBody>;
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  // 2. Validate input
  const validationError = validateRegisterInput(body);
  if (validationError) {
    return badRequestResponse(validationError, "VALIDATION_ERROR");
  }

  // Safe to assert after validation
  const name     = body.name!.trim();
  const email    = body.email!.trim().toLowerCase();
  const password = body.password!;

  try {
    await connectDB();

    // 3. Check for duplicate email
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return badRequestResponse(
        "An account with this email already exists",
        "EMAIL_IN_USE"
      );
    }

    // 4. Hash password
    const passwordHash = await hashPassword(password);

    // 5. Create user
    const user = await User.create({
      name,
      email,
      password: passwordHash,
    });

    // 6. Build sanitised user object (never include password/refreshToken)
    const safeUser = {
      id:        user._id.toString(),
      name:      user.name,
      email:     user.email,
      createdAt: user.createdAt,
    };

    // 7. Issue tokens via cookies
    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        data:    { user: safeUser },
      },
      { status: 201 }
    );

    setAuthCookies(response, safeUser.id, safeUser.email);

    return response;
  } catch (err) {
    // Mongoose duplicate-key error (race condition — two simultaneous registrations)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return badRequestResponse(
        "An account with this email already exists",
        "EMAIL_IN_USE"
      );
    }

    console.error("[POST /api/auth/register]", err);
    return serverErrorResponse();
  }
}