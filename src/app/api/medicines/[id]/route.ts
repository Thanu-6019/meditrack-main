// src/app/api/medicines/[id]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/medicines/:id  → fetch a single medicine (must belong to user)
// PUT    /api/medicines/:id  → update a medicine      (must belong to user)
// DELETE /api/medicines/:id  → delete a medicine      (must belong to user)
//
// OWNERSHIP CHECK (CRITICAL)
// ─────────────────────────────────────────────────────────────────────────────
// Every query uses { _id, userId } together. If the medicine exists but belongs
// to a different user, MongoDB returns null — identical to "not found".
// This prevents both data leakage AND enumeration of other users' medicine IDs.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Medicine, { FREQUENCY_VALUES, ROUTE_OF_ADMIN_VALUES } from "@/models/Medicine";
import { getIdentityFromRequest } from "@/lib/auth-context";
import {
  badRequestResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  notifyMedicineEvent,
} from "@/lib/notification.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a 404 response that reveals nothing about ownership. */
function notFoundResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { message: "Medicine not found", code: "NOT_FOUND" },
    },
    { status: 404 }
  );
}

function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

type UpdateMedicineBody = Partial<{
  name:                  string;
  genericName:           string | null;
  dosage:                string;
  form:                  string | null;
  frequency:             string;
  timesPerDay:           number;
  timeSchedule:          string[];
  startDate:             string;
  endDate:               string | null;
  prescribedBy:          string | null;
  condition:             string | null;
  purpose:               string | null;
  pillsRemaining:        number | null;
  totalPills:            number | null;
  refillDate:            string | null;
  pharmacy:              string | null;
  routeOfAdministration: string;
  instructions:          string | null;
  notes:                 string | null;
  sideEffects:           string[];
  interactions:          string[];
  status:                string;
  takenToday:            boolean;
}>;

function validateUpdateBody(body: UpdateMedicineBody): string | null {
  if (body.name !== undefined) {
    if (!body.name.trim()) return "name cannot be empty";
    if (body.name.trim().length > 200) return "name must be 200 characters or fewer";
  }

  if (body.dosage !== undefined && !body.dosage.trim()) {
    return "dosage cannot be empty";
  }

  if (body.frequency !== undefined) {
    if (!FREQUENCY_VALUES.includes(body.frequency as never)) {
      return `frequency must be one of: ${FREQUENCY_VALUES.join(", ")}`;
    }
  }

  if (body.routeOfAdministration !== undefined) {
    if (!ROUTE_OF_ADMIN_VALUES.includes(body.routeOfAdministration as never)) {
      return `routeOfAdministration must be one of: ${ROUTE_OF_ADMIN_VALUES.join(", ")}`;
    }
  }

  if (body.timeSchedule !== undefined && !Array.isArray(body.timeSchedule)) {
    return "timeSchedule must be an array of time strings";
  }

  if (body.pillsRemaining !== undefined && body.pillsRemaining !== null && body.pillsRemaining < 0) {
    return "pillsRemaining cannot be negative";
  }

  if (body.totalPills !== undefined && body.totalPills !== null && body.totalPills < 1) {
    return "totalPills must be at least 1";
  }

  return null;
}

// ─── GET /api/medicines/:id ───────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Validate ObjectId format
  if (!isValidObjectId(id)) return notFoundResponse();

  try {
    await connectDB();

    // 3. Fetch — MUST match both _id AND userId (ownership check)
    const medicine = await Medicine.findOne({ _id: id, userId }).lean();

    if (!medicine) return notFoundResponse();

    return NextResponse.json({
      success: true,
      data:    {
        medicine: {
          ...medicine,
          id:     medicine._id.toString(),
          userId: medicine.userId.toString(),
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/medicines/:id]", err);
    return serverErrorResponse();
  }
}

// ─── PUT /api/medicines/:id ───────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Validate ObjectId
  if (!isValidObjectId(id)) return notFoundResponse();

  // 3. Parse body
  let body: UpdateMedicineBody;
  try {
    body = (await request.json()) as UpdateMedicineBody;
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  // 4. Validate
  const validationError = validateUpdateBody(body);
  if (validationError) return badRequestResponse(validationError, "VALIDATION_ERROR");

  try {
    await connectDB();

    // 5. Build update object — strip undefined values and NEVER allow userId to be updated
    const updates: Record<string, unknown> = {};

    if (body.name          !== undefined) updates.name          = body.name.trim();
    if (body.genericName   !== undefined) updates.genericName   = body.genericName?.trim() ?? null;
    if (body.dosage        !== undefined) updates.dosage        = body.dosage.trim();
    if (body.form          !== undefined) updates.form          = body.form?.trim() ?? null;
    if (body.frequency     !== undefined) updates.frequency     = body.frequency;
    if (body.timesPerDay   !== undefined) updates.timesPerDay   = body.timesPerDay;
    if (body.timeSchedule  !== undefined) updates.timeSchedule  = body.timeSchedule;
    if (body.startDate     !== undefined) updates.startDate     = new Date(body.startDate);
    if (body.endDate       !== undefined) updates.endDate       = body.endDate ? new Date(body.endDate) : null;
    if (body.prescribedBy  !== undefined) updates.prescribedBy  = body.prescribedBy?.trim() ?? null;
    if (body.condition     !== undefined) updates.condition     = body.condition?.trim() ?? null;
    if (body.purpose       !== undefined) updates.purpose       = body.purpose?.trim() ?? null;
    if (body.pillsRemaining !== undefined) updates.pillsRemaining = body.pillsRemaining;
    if (body.totalPills    !== undefined) updates.totalPills    = body.totalPills;
    if (body.refillDate    !== undefined) updates.refillDate    = body.refillDate ? new Date(body.refillDate) : null;
    if (body.pharmacy      !== undefined) updates.pharmacy      = body.pharmacy?.trim() ?? null;
    if (body.routeOfAdministration !== undefined) updates.routeOfAdministration = body.routeOfAdministration;
    if (body.instructions  !== undefined) updates.instructions  = body.instructions?.trim() ?? null;
    if (body.notes         !== undefined) updates.notes         = body.notes?.trim() ?? null;
    if (body.sideEffects   !== undefined) updates.sideEffects   = body.sideEffects;
    if (body.interactions  !== undefined) updates.interactions  = body.interactions;

    if (body.status !== undefined) {
      updates.status   = body.status;
      updates.isActive = body.status === "active";
    }

    if (body.takenToday !== undefined) {
      updates.takenToday = body.takenToday;
    }

    if (Object.keys(updates).length === 0) {
      return badRequestResponse("No updatable fields provided", "NO_CHANGES");
    }

    // 6. Update — MUST match _id AND userId (ownership check)
    const updated = await Medicine.findOneAndUpdate(
      { _id: id, userId },            // ← ownership enforced here
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return notFoundResponse();

    // 7. Notifications — fire-and-forget
    void notifyMedicineEvent({
      userId,
      kind: "updated",
      medicineId: updated._id,
      title: "Medicine Updated",
      message: `Your medicine ${updated.name} has been updated.`,
      actionUrl: "/medicines",
      actionLabel: "View medicines",
    });

    // Also fire a refill alert if pills just dropped low
    if (
      updated.pillsRemaining !== null &&
      updated.totalPills     !== null &&
      updated.pillsRemaining < updated.totalPills * 0.3
    ) {
      void notifyMedicineEvent({
        userId,
        kind: "refill_needed",
        medicineId: updated._id,
        title: "Refill Needed",
        message: `Your medicine ${updated.name} is running low (${updated.pillsRemaining} pills remaining).`,
        actionUrl: "/medicines",
        actionLabel: "View medicines",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Medicine updated successfully",
      data:    {
        medicine: {
          ...updated,
          id:     updated._id.toString(),
          userId: updated.userId.toString(),
        },
      },
    });
  } catch (err) {
    console.error("[PUT /api/medicines/:id]", err);
    return serverErrorResponse();
  }
}

// ─── DELETE /api/medicines/:id ────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Validate ObjectId
  if (!isValidObjectId(id)) return notFoundResponse();

  try {
    await connectDB();

    // 3. Delete — MUST match _id AND userId (ownership check)
    const deleted = await Medicine.findOneAndDelete({ _id: id, userId }).lean();

    if (!deleted) return notFoundResponse();

    // 4. Notification — fire-and-forget
    void notifyMedicineEvent({
      userId,
      kind: "discontinued",
      medicineId: deleted._id,
      title: "Medicine Removed",
      message: `Your medicine ${deleted.name} has been removed.`,
      actionUrl: "/medicines",
      actionLabel: "View medicines",
    });

    return NextResponse.json({
      success: true,
      message: "Medicine removed successfully",
      data:    { deletedId: id },
    });
  } catch (err) {
    console.error("[DELETE /api/medicines/:id]", err);
    return serverErrorResponse();
  }
}