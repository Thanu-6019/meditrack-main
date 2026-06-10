// src/app/api/medicines/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/medicines   → list all medicines for the authenticated user
// POST /api/medicines   → create a new medicine for the authenticated user
//
// SECURITY INVARIANTS
// ─────────────────────────────────────────────────────────────────────────────
// • userId is ALWAYS read from the JWT injected by middleware (x-user-id header).
//   It is NEVER accepted from the request body.
// • All DB queries include { userId } so no cross-user data is ever returned.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
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

interface CreateMedicineBody {
  name?:                  string;
  genericName?:           string;
  dosage?:                string;
  form?:                  string;
  frequency?:             string;
  timesPerDay?:           number;
  timeSchedule?:          string[];
  startDate?:             string;
  endDate?:               string | null;
  prescribedBy?:          string;
  condition?:             string;
  purpose?:               string;
  pillsRemaining?:        number;
  totalPills?:            number;
  refillDate?:            string | null;
  pharmacy?:              string;
  routeOfAdministration?: string;
  instructions?:          string;
  notes?:                 string;
  sideEffects?:           string[];
  interactions?:          string[];
  status?:                string;
}

function validateCreateBody(body: CreateMedicineBody): string | null {
  if (!body.name?.trim())    return "name is required";
  if (body.name.trim().length > 200) return "name must be 200 characters or fewer";

  if (!body.dosage?.trim())  return "dosage is required";
  if (body.dosage.trim().length > 100) return "dosage must be 100 characters or fewer";

  if (!body.frequency?.trim()) return "frequency is required";
  if (!FREQUENCY_VALUES.includes(body.frequency as never)) {
    return `frequency must be one of: ${FREQUENCY_VALUES.join(", ")}`;
  }

  if (body.routeOfAdministration && !ROUTE_OF_ADMIN_VALUES.includes(body.routeOfAdministration as never)) {
    return `routeOfAdministration must be one of: ${ROUTE_OF_ADMIN_VALUES.join(", ")}`;
  }

  if (body.timeSchedule !== undefined && !Array.isArray(body.timeSchedule)) {
    return "timeSchedule must be an array of time strings";
  }

  if (body.pillsRemaining !== undefined && body.pillsRemaining < 0) {
    return "pillsRemaining cannot be negative";
  }

  if (body.totalPills !== undefined && body.totalPills < 1) {
    return "totalPills must be at least 1";
  }

  return null;
}

// ─── GET /api/medicines ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Auth — identity injected by middleware
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);

  const { userId } = identity.data;

  try {
    await connectDB();

    // 2. Parse optional query params for filtering
    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get("status");   // "active" | "paused" | etc.
    const search       = searchParams.get("search");   // name substring search

    // 3. Build query — userId is ALWAYS included
    const query: Record<string, unknown> = { userId };

    if (statusFilter) {
      query.status = statusFilter;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // 4. Fetch — newest first
    const medicines = await Medicine.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // 5. Transform ObjectIds to strings for the client
    const data = medicines.map((m) => ({
      ...m,
      id:     m._id.toString(),
      userId: m.userId.toString(),
    }));

    return NextResponse.json({
      success: true,
      data:    { medicines: data, total: data.length },
    });
  } catch (err) {
    console.error("[GET /api/medicines]", err);
    return serverErrorResponse();
  }
}

// ─── POST /api/medicines ──────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);

  const { userId } = identity.data;

  // 2. Parse body
  let body: CreateMedicineBody;
  try {
    body = (await request.json()) as CreateMedicineBody;
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  // 3. Validate
  const validationError = validateCreateBody(body);
  if (validationError) return badRequestResponse(validationError, "VALIDATION_ERROR");

  try {
    await connectDB();

    // 4. Build the medicine document — userId from JWT only, never from body
    const medicine = await Medicine.create({
      userId,                                                    // ← JWT only
      name:                  body.name!.trim(),
      genericName:           body.genericName?.trim()           ?? null,
      dosage:                body.dosage!.trim(),
      form:                  body.form?.trim()                  ?? null,
      frequency:             body.frequency,
      timesPerDay:           body.timesPerDay                   ?? 1,
      timeSchedule:          body.timeSchedule                  ?? [],
      startDate:             body.startDate ? new Date(body.startDate) : new Date(),
      endDate:               body.endDate   ? new Date(body.endDate)   : null,
      prescribedBy:          body.prescribedBy?.trim()          ?? null,
      condition:             body.condition?.trim()              ?? null,
      purpose:               body.purpose?.trim()               ?? null,
      pillsRemaining:        body.pillsRemaining                ?? null,
      totalPills:            body.totalPills                    ?? null,
      refillDate:            body.refillDate ? new Date(body.refillDate) : null,
      pharmacy:              body.pharmacy?.trim()              ?? null,
      routeOfAdministration: body.routeOfAdministration        ?? "oral",
      instructions:          body.instructions?.trim()          ?? null,
      notes:                 body.notes?.trim()                 ?? null,
      sideEffects:           body.sideEffects                   ?? [],
      interactions:          body.interactions                  ?? [],
      status:                body.status                        ?? "active",
    });

    // 5. Trigger notifications (fire-and-forget — never blocks the response)
    void notifyMedicineEvent({
      userId,
      kind: "added",
      medicineId: medicine._id,
      title: "Medicine Added",
      message: `Your medicine ${medicine.name} has been successfully added.`,
      actionUrl: "/medicines",
      actionLabel: "View medicines",
    });

    // 6. Trigger refill alert if supply is already low on creation
    if (
      medicine.pillsRemaining !== null &&
      medicine.totalPills     !== null &&
      medicine.pillsRemaining < medicine.totalPills * 0.3
    ) {
      void notifyMedicineEvent({
        userId,
        kind: "refill_needed",
        medicineId: medicine._id,
        title: "Refill Needed",
        message: `Your medicine ${medicine.name} is running low (${medicine.pillsRemaining} pills remaining).`,
        actionUrl: "/medicines",
        actionLabel: "View medicines",
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Medicine created successfully",
        data:    {
          medicine: {
            ...medicine.toJSON(),
            id:     medicine._id.toString(),
            userId: medicine.userId.toString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/medicines]", err);
    return serverErrorResponse();
  }
}