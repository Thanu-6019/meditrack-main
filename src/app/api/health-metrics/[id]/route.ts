// src/app/api/health-metrics/[id]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/health-metrics/:id  → fetch a single reading (must belong to user)
// DELETE /api/health-metrics/:id  → remove a reading (must belong to user)
//
// UPDATE is intentionally omitted.
// Health metrics are immutable event records — if a reading was wrong, delete
// it and log a new one. This preserves audit history and keeps the data model
// simple for future AI/ML pipelines.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import HealthMetric from "@/models/HealthMetric";
import { getIdentityFromRequest } from "@/lib/auth-context";
import { serverErrorResponse, unauthorizedResponse } from "@/lib/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFoundResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: { message: "Health metric not found", code: "NOT_FOUND" } },
    { status: 404 }
  );
}

function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

// ─── GET /api/health-metrics/:id ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  if (!isValidObjectId(id)) return notFoundResponse();

  try {
    await connectDB();

    // Ownership enforced by { _id, userId } — cross-user IDs return null
    const metric = await HealthMetric.findOne({ _id: id, userId }).lean();

    if (!metric) return notFoundResponse();

    return NextResponse.json({
      success: true,
      data: {
        metric: {
          ...metric,
          id:     metric._id.toString(),
          userId: metric.userId.toString(),
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/health-metrics/:id]", err);
    return serverErrorResponse();
  }
}

// ─── DELETE /api/health-metrics/:id ──────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  if (!isValidObjectId(id)) return notFoundResponse();

  try {
    await connectDB();

    // Ownership enforced by { _id, userId }
    const deleted = await HealthMetric.findOneAndDelete({ _id: id, userId }).lean();

    if (!deleted) return notFoundResponse();

    return NextResponse.json({
      success: true,
      message: "Health metric deleted successfully",
      data: {
        deletedId: id,
        type:      deleted.type,
        timestamp: deleted.timestamp.toISOString(),
      },
    });
  } catch (err) {
    console.error("[DELETE /api/health-metrics/:id]", err);
    return serverErrorResponse();
  }
}