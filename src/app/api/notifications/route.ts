// src/app/api/notifications/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/notifications  — paginated, filtered inbox for the current user
// POST /api/notifications  — internal-only notification creation
//
// SECURITY
// ─────────────────────────────────────────────────────────────────────────────
// Both endpoints require a valid JWT (enforced by middleware before this runs).
// The userId is always read from the JWT headers injected by middleware —
// never from the request body or query string.
//
// The POST endpoint is marked "internal" meaning it should only be called by
// server-side services (medicines module, health metrics, AI, scheduled jobs).
// An extra `x-internal-token` header check is added as a defence-in-depth
// guard.  In production, restrict this endpoint at the load-balancer/gateway
// level so it is not reachable from the internet at all.
//
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
// We use skip/limit (not cursor-based) because the inbox is small (< few K
// rows per user) and offset pagination is simpler for the frontend to implement
// with a "load more" button.  Switch to cursor pagination if you ever support
// very high notification volumes.
//
// Unread count is ALWAYS computed with countDocuments — never from the page
// slice — so it stays accurate across pages.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import Notification, { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from "@/models/Notification";
import { getUnreadCount } from "@/lib/notification.service";
import { getIdentityFromRequest } from "@/lib/auth-context";
import { badRequestResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/auth";

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
// GET /api/notifications
// ─────────────────────────────────────────────────────────────────────────────
// Query params:
//   read    = "true" | "false"          (optional filter)
//   type    = "medicine" | "system" …   (optional filter)
//   limit   = 1–100                     (default 20)
//   page    = 1+                        (default 1)
//
// Response:
//   {
//     success: true,
//     data: {
//       notifications: [...],
//       unreadCount: 5,
//       pagination: { page, limit, total, hasMore }
//     }
//   }
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Auth — identity from middleware headers
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  const { searchParams } = request.nextUrl;

  // 2. Parse + validate query params
  const readParam  = searchParams.get("read");   // "true" | "false" | null
  const typeParam  = searchParams.get("type");   // NotificationTypeValue | null
  const limitParam = parseInt(searchParams.get("limit") ?? "20", 10);
  const pageParam  = parseInt(searchParams.get("page")  ?? "1",  10);

  if (typeParam && !NOTIFICATION_TYPES.includes(typeParam as never)) {
    return badRequestResponse(
      `Invalid type. Allowed: ${NOTIFICATION_TYPES.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  const limit = Math.min(Math.max(isNaN(limitParam) ? 20 : limitParam, 1), 100);
  const page  = Math.max(isNaN(pageParam) ? 1 : pageParam, 1);
  const skip  = (page - 1) * limit;

  try {
    await connectDB();

    const userObjectId = new (Types.ObjectId as any)(userId);

    // 3. Build filter — userId is ALWAYS included
    const filter: Record<string, unknown> = { userId: userObjectId };

    if (readParam === "true")  filter.read = true;
    if (readParam === "false") filter.read = false;
    if (typeParam)             filter.type = typeParam;

    // 4. Run query + total count in parallel
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })   // newest first — always
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      getUnreadCount(userId),     // always full unread count, not filtered
    ]);

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          hasMore: skip + notifications.length < total,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return serverErrorResponse();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications  — INTERNAL USE ONLY
// ─────────────────────────────────────────────────────────────────────────────
// This endpoint is for backend services (medicines module, health metrics, AI
// assistant, scheduled jobs).  It must NOT be called directly from the browser.
//
// Defence-in-depth: requires the `X-Internal-Token` header to match the env
// variable INTERNAL_API_SECRET.  In production, additionally restrict this
// route at the gateway/firewall level.
//
// Request body:
//   {
//     title:       string (required)
//     message:     string (required)
//     type:        NotificationTypeValue (required)
//     priority?:   "low" | "medium" | "high"
//     actionUrl?:  string
//     actionLabel?: string
//     relatedId?:  string
//     relatedModel?: "Medicine" | "MedicationLog" | "HealthMetric"
//     metadata?:   object
//     channel?:    "in_app" | "push" | "email"
//   }
//
// The `userId` in the body is accepted ONLY when the internal token is present
// and valid — allowing the medicines / health-metrics modules to target specific
// users.  Without the token the JWT userId is used.
// ─────────────────────────────────────────────────────────────────────────────

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

interface CreateNotificationBody {
  title:        string;
  message:      string;
  type?:        string;
  priority?:    string;
  userId?:      string;   // only honoured with valid internal token
  actionUrl?:   string;
  actionLabel?: string;
  relatedId?:   string;
  relatedModel?: string;
  metadata?:    Record<string, unknown>;
  channel?:     string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth — JWT identity from middleware
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);

  // 2. Internal token check
  const internalToken = request.headers.get("x-internal-token") ?? "";
  const isInternal    = INTERNAL_SECRET && internalToken === INTERNAL_SECRET;

  // 3. Parse body
  let body: CreateNotificationBody;
  try {
    body = (await request.json()) as CreateNotificationBody;
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  // 4. Validate required fields
  if (!body.title?.trim())   return badRequestResponse("title is required",   "VALIDATION_ERROR");
  if (!body.message?.trim()) return badRequestResponse("message is required", "VALIDATION_ERROR");

  const type = (body.type ?? "system") as string;
  if (!NOTIFICATION_TYPES.includes(type as never)) {
    return badRequestResponse(
      `Invalid type. Allowed: ${NOTIFICATION_TYPES.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  if (body.priority && !NOTIFICATION_PRIORITIES.includes(body.priority as never)) {
    return badRequestResponse(
      `Invalid priority. Allowed: ${NOTIFICATION_PRIORITIES.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  // 5. Determine target userId
  //    Internal services may target any user by providing userId in the body.
  //    Unauthenticated-body requests always use the JWT userId.
  let targetUserId: string;
  if (isInternal && body.userId) {
    if (!mongoose.isValidObjectId(body.userId)) {
      return badRequestResponse("Invalid userId", "VALIDATION_ERROR");
    }
    targetUserId = body.userId;
  } else {
    targetUserId = identity.data.userId;
  }

  // 6. Validate relatedModel if provided
  const VALID_RELATED_MODELS = ["Medicine", "MedicationLog", "HealthMetric"];
  if (body.relatedModel && !VALID_RELATED_MODELS.includes(body.relatedModel)) {
    return badRequestResponse(
      `Invalid relatedModel. Allowed: ${VALID_RELATED_MODELS.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  try {
    await connectDB();

    const notification = await Notification.create({
      userId:       new (Types.ObjectId as any)(targetUserId),
      title:        body.title.trim(),
      message:      body.message.trim(),
      type,
      priority:     body.priority     ?? "medium",
      actionUrl:    body.actionUrl    ?? null,
      actionLabel:  body.actionLabel  ?? null,
      relatedId:    body.relatedId && mongoose.isValidObjectId(body.relatedId)
        ? new (Types.ObjectId as any)(body.relatedId)
        : null,
      relatedModel: (body.relatedModel as INotificationRelatedModel) ?? null,
      metadata:     body.metadata ?? null,
      channel:      body.channel  ?? "in_app",
      isDelivered:  false,
      read:         false,
    });

    return NextResponse.json(
      { success: true, data: { notification } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/notifications]", err);
    return serverErrorResponse();
  }
}

// Small local alias to keep TypeScript happy with the relatedModel assignment
type INotificationRelatedModel = "Medicine" | "MedicationLog" | "HealthMetric" | null;