// src/app/api/health-metrics/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/health-metrics  → list metrics with time-series + summary stats
// POST /api/health-metrics  → record a new metric reading
//
// SUMMARY LOGIC
// ─────────────────────────────────────────────────────────────────────────────
// Numeric types (weight, glucose, heart_rate, etc.):
//   average, min, max computed server-side from the filtered result set.
//
// Blood pressure (compound):
//   Returns separate systolic/diastolic averages.
//
// Custom / non-numeric:
//   summary is null — no math attempted.
//
// CHART FORMAT
// ─────────────────────────────────────────────────────────────────────────────
// Default sort is timestamp ASC (oldest→newest) so the frontend can pass the
// array directly to a Recharts <LineChart> or similar without reordering.
// Pass ?sort=desc to get newest-first for a "recent readings" list.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import HealthMetric, {
  METRIC_TYPES,
  NUMERIC_METRIC_TYPES,
  COMPOUND_METRIC_TYPES,
  DEFAULT_UNITS,
  type MetricType,
} from "@/models/HealthMetric";
import { getIdentityFromRequest } from "@/lib/auth-context";
import { badRequestResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NumericSummary {
  average: number;
  min:     number;
  max:     number;
  count:   number;
}

interface BpSummary {
  systolic:  NumericSummary;
  diastolic: NumericSummary;
  count:     number;
}

type Summary = NumericSummary | BpSummary | null;

interface ChartPoint {
  timestamp:    string; // ISO string — Recharts / D3 both accept this
  value:        number | null;
  systolic?:    number | null;
  diastolic?:   number | null;
  displayValue: string;
  status:       string;
  notes:        string | null;
}

// ─── Summary builders ─────────────────────────────────────────────────────────

function buildNumericSummary(values: number[]): NumericSummary {
  const count = values.length;
  if (count === 0) return { average: 0, min: 0, max: 0, count: 0 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = Math.round((values.reduce((a, b) => a + b, 0) / count) * 10) / 10;

  return { average, min, max, count };
}

function buildSummary(
  type: MetricType,
  metrics: Array<{ value: number | null; systolic: number | null; diastolic: number | null }>
): Summary {
  if (NUMERIC_METRIC_TYPES.has(type)) {
    const nums = metrics
      .map((m) => m.value)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    return buildNumericSummary(nums);
  }

  if (COMPOUND_METRIC_TYPES.has(type)) {
    const systolicNums = metrics
      .map((m) => m.systolic)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const diastolicNums = metrics
      .map((m) => m.diastolic)
      .filter((v): v is number => v !== null && Number.isFinite(v));

    return {
      systolic:  buildNumericSummary(systolicNums),
      diastolic: buildNumericSummary(diastolicNums),
      count:     metrics.length,
    };
  }

  return null; // custom / unknown type — no aggregation
}

// ─── GET /api/health-metrics ──────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  const { searchParams } = request.nextUrl;

  // 2. Parse query params
  const typeParam  = searchParams.get("type");
  const fromParam  = searchParams.get("from");
  const toParam    = searchParams.get("to");
  const limitParam = searchParams.get("limit");
  const sortParam  = searchParams.get("sort"); // "asc" | "desc"  (default: asc for charts)
  const tagsParam  = searchParams.get("tags"); // comma-separated tag filter

  // Validate type
  if (typeParam && !METRIC_TYPES.includes(typeParam as MetricType)) {
    return badRequestResponse(
      `Invalid type. Allowed values: ${METRIC_TYPES.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  // Validate limit
  const limit = Math.min(parseInt(limitParam ?? "50", 10) || 50, 500);

  // Validate dates
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (fromParam) {
    fromDate = new Date(fromParam);
    if (isNaN(fromDate.getTime())) {
      return badRequestResponse("Invalid 'from' date format. Use ISO 8601.", "VALIDATION_ERROR");
    }
  }
  if (toParam) {
    toDate = new Date(toParam);
    if (isNaN(toDate.getTime())) {
      return badRequestResponse("Invalid 'to' date format. Use ISO 8601.", "VALIDATION_ERROR");
    }
    // Make `to` inclusive by pushing it to end-of-day if no time component was given
    if (!toParam.includes("T")) {
      toDate.setHours(23, 59, 59, 999);
    }
  }

  if (fromDate && toDate && fromDate > toDate) {
    return badRequestResponse("'from' date must be before 'to' date", "VALIDATION_ERROR");
  }

  try {
    await connectDB();

    // 3. Build query — userId is ALWAYS included
    const query: Record<string, unknown> = { userId };

    if (typeParam) query.type = typeParam;

    if (fromDate || toDate) {
      const timestampFilter: Record<string, Date> = {};
      if (fromDate) timestampFilter.$gte = fromDate;
      if (toDate)   timestampFilter.$lte = toDate;
      query.timestamp = timestampFilter;
    }

    if (tagsParam) {
      const tagList = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) query.tags = { $in: tagList };
    }

    // 4. Sort — ASC by default (chart-ready order: oldest → newest)
    const sortOrder = sortParam === "desc" ? -1 : 1;

    const metrics = await HealthMetric.find(query)
      .sort({ timestamp: sortOrder })
      .limit(limit)
      .lean();

    // 5. Build chart-ready points
    const chartPoints: ChartPoint[] = metrics.map((m) => ({
      id:           m._id.toString(),
      timestamp:    m.timestamp.toISOString(),
      value:        m.value,
      systolic:     m.systolic,
      diastolic:    m.diastolic,
      displayValue: m.displayValue,
      status:       m.status,
      notes:        m.notes,
      tags:         m.tags,
      unit:         m.unit,
      type:         m.type,
      source:       m.source,
    }));

    // 6. Build server-side summary (only when querying a single type)
    let summary: Summary = null;
    if (typeParam) {
      summary = buildSummary(typeParam as MetricType, metrics);
    }

    // 7. Latest reading per type (useful for dashboard "current values")
    const latestMap: Record<string, ChartPoint> = {};
    for (const point of [...chartPoints].reverse()) {
      if (!(point as unknown as { type: string }).type) continue;
      const t = (point as unknown as { type: string }).type;
      if (!latestMap[t]) latestMap[t] = point;
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics:   chartPoints,
        total:     chartPoints.length,
        summary,
        // Convenience: latest reading per each type present in the result set
        latest:    latestMap,
        query: {
          type:  typeParam  ?? null,
          from:  fromDate?.toISOString() ?? null,
          to:    toDate?.toISOString()   ?? null,
          limit,
          sort:  sortParam === "desc" ? "desc" : "asc",
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/health-metrics]", err);
    return serverErrorResponse();
  }
}

// ─── POST /api/health-metrics ─────────────────────────────────────────────────

interface CreateMetricBody {
  type?:       string;
  value?:      number | null;
  systolic?:   number;
  diastolic?:  number;
  unit?:       string;
  timestamp?:  string;
  notes?:      string;
  tags?:       string[];
  source?:     string;
  deviceId?:   string;
  customLabel?: string;
}

function validateCreateBody(body: CreateMetricBody): string | null {
  if (!body.type?.trim()) return "type is required";
  if (!METRIC_TYPES.includes(body.type as MetricType)) {
    return `type must be one of: ${METRIC_TYPES.join(", ")}`;
  }

  const type = body.type as MetricType;

  if (type === "blood_pressure") {
    // Blood pressure requires systolic + diastolic
    if (body.systolic === undefined || body.diastolic === undefined) {
      return "blood_pressure requires both systolic and diastolic values";
    }
    if (body.systolic < 60  || body.systolic > 300)  return "systolic value out of range (60–300)";
    if (body.diastolic < 40 || body.diastolic > 200) return "diastolic value out of range (40–200)";
    if (body.diastolic >= body.systolic) return "diastolic must be less than systolic";
  } else if (type !== "custom") {
    // All other typed metrics require a numeric value
    if (body.value === undefined || body.value === null) {
      return "value is required for this metric type";
    }
    if (!Number.isFinite(body.value)) return "value must be a finite number";
    if (body.value < 0) return "value cannot be negative";
  }

  if (body.timestamp) {
    const d = new Date(body.timestamp);
    if (isNaN(d.getTime())) return "Invalid timestamp format. Use ISO 8601.";
    if (d > new Date()) return "timestamp cannot be in the future";
  }

  if (body.tags && !Array.isArray(body.tags)) return "tags must be an array of strings";
  if (body.notes && body.notes.length > 500)  return "notes must be 500 characters or fewer";

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Parse body
  let body: CreateMetricBody;
  try {
    body = (await request.json()) as CreateMetricBody;
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  // 3. Validate
  const validationError = validateCreateBody(body);
  if (validationError) return badRequestResponse(validationError, "VALIDATION_ERROR");

  const type = body.type as MetricType;

  try {
    await connectDB();

    // 4. Build document — userId from JWT only
    const docData: Record<string, unknown> = {
      userId,                                           // ← JWT only, never from body
      type,
      customLabel: body.customLabel?.trim() ?? null,
      unit:        body.unit?.trim() ?? DEFAULT_UNITS[type] ?? null,
      timestamp:   body.timestamp ? new Date(body.timestamp) : new Date(),
      notes:       body.notes?.trim() ?? null,
      tags:        body.tags ?? [],
      source:      body.source ?? "manual",
      deviceId:    body.deviceId ?? null,
    };

    if (type === "blood_pressure") {
      docData.systolic  = body.systolic;
      docData.diastolic = body.diastolic;
      docData.value     = body.systolic; // primary value = systolic for indexing
    } else {
      docData.value     = body.value;
      docData.systolic  = null;
      docData.diastolic = null;
    }

    // 5. Create — pre-validate hook computes displayValue + status
    const metric = await HealthMetric.create(docData);

    return NextResponse.json(
      {
        success: true,
        message: "Health metric recorded successfully",
        data:    {
          metric: {
            ...metric.toJSON(),
            id:     metric._id.toString(),
            userId: metric.userId.toString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/health-metrics]", err);
    return serverErrorResponse();
  }
}