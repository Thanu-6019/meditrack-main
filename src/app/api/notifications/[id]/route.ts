// src/app/api/notifications/[id]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// PATCH  /api/notifications/:id  — mark read / unread
// DELETE /api/notifications/:id  — remove notification
//
// OWNERSHIP
// ─────────────────────────────────────────────────────────────────────────────
// Every query includes BOTH _id AND userId from the JWT.  This guarantees that:
//   • User A cannot read or delete User B's notifications.
//   • A 404 is returned for both "not found" and "not yours" — no information
//     leakage about whether the notification exists at all.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { getIdentityFromRequest } from "@/lib/auth-context";
import {
  badRequestResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/auth";

// ─── Shared param type ────────────────────────────────────────────────────────

type RouteParams = { params: Promise<{ id: string }> };

// Helper — validate ObjectId and return 400 if invalid
function validateId(id: string): NextResponse | null {
  if (!mongoose.isValidObjectId(id)) {
    return badRequestResponse("Invalid notification ID", "VALIDATION_ERROR");
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id
// ─────────────────────────────────────────────────────────────────────────────
// Request body: { "read": true | false }
//
// Only the `read` field can be patched through this endpoint.
// `readAt` is automatically maintained by the Mongoose pre-save hook.
//
// Response (success):
//   {
//     "success": true,
//     "data": { "notification": { ...updatedDoc } }
//   }
//
// Response (not found / wrong user):
//   404
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Param validation
  const { id } = await params;
  const idError = validateId(id);
  if (idError) return idError;

  // 3. Parse body
  let body: { read?: unknown };
  try {
    body = (await request.json()) as { read?: unknown };
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  if (typeof body.read !== "boolean") {
    return badRequestResponse(
      "Body must contain { \"read\": true | false }",
      "VALIDATION_ERROR"
    );
  }

  try {
    await connectDB();

    // 4. findOneAndUpdate with ownership filter — single round-trip
    const notification = await Notification.findOneAndUpdate(
      {
        _id:    new (mongoose.Types.ObjectId as any)(id),
        userId: new (mongoose.Types.ObjectId as any)(userId), // ownership enforced here
      },
      {
        $set: {
          read:   body.read,
          readAt: body.read ? new Date() : null,
        },
      },
      { new: true, runValidators: true }
    );

    if (!notification) {
      return NextResponse.json(
        { success: false, error: { message: "Notification not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { notification },
    });
  } catch (err) {
    console.error("[PATCH /api/notifications/:id]", err);
    return serverErrorResponse();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// ─────────────────────────────────────────────────────────────────────────────
// Permanently removes the notification.
//
// Response (success): 200 { success: true, data: { deleted: true } }
// Response (not found / wrong user): 404
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Param validation
  const { id } = await params;
  const idError = validateId(id);
  if (idError) return idError;

  try {
    await connectDB();

    // 3. Delete with ownership filter — returns null if not found or wrong user
    const deleted = await Notification.findOneAndDelete({
      _id:    new (mongoose.Types.ObjectId as any)(id),
      userId: new (mongoose.Types.ObjectId as any)(userId), // ownership enforced here
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { message: "Notification not found", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (err) {
    console.error("[DELETE /api/notifications/:id]", err);
    return serverErrorResponse();
  }
}