// src/app/api/auth/me/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
//
// Returns the currently authenticated user.
// Useful for: session validation on app load, profile hydration, SSR auth checks.
//
// This endpoint is also a good test that your cookies are being sent correctly.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  getAuthFromRequest,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Verify access token from cookie
  const auth = getAuthFromRequest(request);

  if (!auth.authenticated) {
    return unauthorizedResponse(auth.reason);
  }

  try {
    await connectDB();

    // 2. Fetch fresh user data from DB (don't rely solely on JWT payload)
    const user = await User.findById(auth.user.userId).lean();

    if (!user || !user.isActive) {
      return unauthorizedResponse("User not found or account disabled");
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id:           user._id.toString(),
          name:         user.name,
          email:        user.email,
          age:          user.age,
          gender:       user.gender,
          phone:        user.phone,
          healthProfile: user.healthProfile,
          lastLogin:    user.lastLogin,
          createdAt:    user.createdAt,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return serverErrorResponse();
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // 1. Verify access token from cookie
  const auth = getAuthFromRequest(request);

  if (!auth.authenticated) {
    return unauthorizedResponse(auth.reason);
  }

  try {
    await connectDB();
    const body = await request.json();

    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.email !== undefined) updates.email = body.email.trim().toLowerCase();
    if (body.phone !== undefined) updates.phone = body.phone.trim();
    if (body.age !== undefined) updates.age = parseInt(body.age, 10) || null;
    if (body.gender !== undefined) updates.gender = body.gender;
    if (body.dateOfBirth !== undefined) updates.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    
    if (body.healthProfile !== undefined && body.healthProfile !== null) {
      updates.healthProfile = {
        weight: body.healthProfile.weight !== undefined ? (parseFloat(body.healthProfile.weight) || null) : null,
        bloodPressure: body.healthProfile.bloodPressure !== undefined ? body.healthProfile.bloodPressure : null,
        glucoseLevel: body.healthProfile.glucoseLevel !== undefined ? (parseFloat(body.healthProfile.glucoseLevel) || null) : null,
      };
    }

    const user = await User.findByIdAndUpdate(
      auth.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      return unauthorizedResponse("User not found");
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id:           user._id.toString(),
          name:         user.name,
          email:        user.email,
          age:          user.age,
          gender:       user.gender,
          phone:        user.phone,
          healthProfile: user.healthProfile,
          lastLogin:    user.lastLogin,
          createdAt:    user.createdAt,
        },
      },
    });
  } catch (err) {
    console.error("[PUT /api/auth/me]", err);
    return serverErrorResponse();
  }
}