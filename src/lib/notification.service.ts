// src/lib/notification.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Notification service — the single write surface for all notification creation.
//
// RULES
// ─────────────────────────────────────────────────────────────────────────────
// 1. ALL modules (medicines, health metrics, AI, system) MUST go through these
//    helpers.  No module should call Notification.create() directly.
//
// 2. userId always comes from the calling service (which got it from the JWT).
//    Never accept userId from request bodies.
//
// 3. Priority is auto-assigned here based on event semantics.  Callers may
//    override with an explicit `priority` option if needed.
//
// REAL-TIME UPGRADE PATH
// ─────────────────────────────────────────────────────────────────────────────
// Step 1 (current): write to MongoDB → client polls GET /api/notifications.
//
// Step 2 (SSE):     after Notification.create(), emit on an EventEmitter that
//                   a GET /api/notifications/stream handler subscribes to.
//                   Zero model changes — just pipe the saved doc to the stream.
//
// Step 3 (WS):      replace EventEmitter with a WebSocket broadcast (Socket.io
//                   room per userId, or a dedicated WS gateway).
//
// Step 4 (Push):    after create(), if user.pushToken exists, enqueue a job to
//                   call APNs/FCM.  Set isDelivered=true on success.
//                   channel field on the document already tracks this.
//
// None of those steps require a schema migration because isDelivered and
// channel are already present on the model.
// ─────────────────────────────────────────────────────────────────────────────

import connectDB from "./mongodb";
import Notification, {
  type NotificationTypeValue,
  type NotificationPriorityValue,
  type NotificationChannelValue,
  type INotification,
} from "@/models/Notification";
import { Types } from "mongoose";

// ─── Shared input shape ───────────────────────────────────────────────────────

interface BaseNotificationInput {
  userId:      string | Types.ObjectId;
  title:       string;
  message:     string;
  priority?:   NotificationPriorityValue;
  actionUrl?:  string;
  actionLabel?: string;
  relatedId?:  string | Types.ObjectId;
  relatedModel?: INotification["relatedModel"];
  metadata?:   Record<string, unknown>;
  channel?:    NotificationChannelValue;
}

// ─── Internal core creator (not exported — use typed helpers below) ───────────

async function createNotification(
  type: NotificationTypeValue,
  defaultPriority: NotificationPriorityValue,
  input: BaseNotificationInput
): Promise<INotification> {
  await connectDB();

  const notification = await Notification.create({
    userId:       new (Types.ObjectId as any)(input.userId.toString()),
    title:        input.title.trim(),
    message:      input.message.trim(),
    type,
    priority:     input.priority ?? defaultPriority,
    actionUrl:    input.actionUrl    ?? null,
    actionLabel:  input.actionLabel  ?? null,
    relatedId:    input.relatedId
      ? new (Types.ObjectId as any)(input.relatedId.toString())
      : null,
    relatedModel: input.relatedModel ?? null,
    metadata:     input.metadata     ?? null,
    channel:      input.channel      ?? "in_app",
    isDelivered:  false,
    read:         false,
  });

  return notification;
}

// ─── Medicine events ──────────────────────────────────────────────────────────

export type MedicineEventKind =
  | "dose_due"          // upcoming scheduled dose — medium
  | "dose_missed"       // past scheduled dose not taken — HIGH
  | "dose_taken"        // confirmation — low
  | "refill_needed"     // pills running low — HIGH
  | "added"             // new medicine created — low
  | "updated"           // medicine record changed — low
  | "discontinued";     // medicine stopped — medium

const MEDICINE_PRIORITY: Record<MedicineEventKind, NotificationPriorityValue> = {
  dose_due:        "medium",
  dose_missed:     "high",
  dose_taken:      "low",
  refill_needed:   "high",
  added:           "low",
  updated:         "low",
  discontinued:    "medium",
};

interface MedicineNotificationInput extends BaseNotificationInput {
  kind:       MedicineEventKind;
  medicineId: string | Types.ObjectId;
}

/**
 * notifyMedicineEvent
 * Call this from the medicines API route or a scheduled job after any
 * medicine-related action.
 *
 * ```ts
 * await notifyMedicineEvent({
 *   userId:     "abc123",
 *   kind:       "dose_missed",
 *   medicineId: med._id,
 *   title:      "Missed dose — Lisinopril",
 *   message:    "You missed your 12:00 PM Lisinopril 10mg dose.",
 *   actionUrl:  "/medicines",
 *   actionLabel:"View medicines",
 * });
 * ```
 */
export async function notifyMedicineEvent(
  input: MedicineNotificationInput
): Promise<INotification> {
  return createNotification("medicine", MEDICINE_PRIORITY[input.kind], {
    ...input,
    relatedId:    input.medicineId,
    relatedModel: "Medicine",
  });
}

// ─── Health metric events ─────────────────────────────────────────────────────

export type MetricEventKind =
  | "reading_abnormal"  // out of reference range — HIGH
  | "reading_critical"  // dangerously out of range — HIGH
  | "reading_normal"    // back in range after abnormal — low
  | "streak_milestone"; // e.g. 7 consecutive normal readings — low

const METRIC_PRIORITY: Record<MetricEventKind, NotificationPriorityValue> = {
  reading_abnormal:  "high",
  reading_critical:  "high",
  reading_normal:    "low",
  streak_milestone:  "low",
};

interface MetricNotificationInput extends BaseNotificationInput {
  kind:     MetricEventKind;
  metricId: string | Types.ObjectId;
}

/**
 * notifyHealthMetricEvent
 * Call this from the health-metrics POST handler when a reading is saved.
 *
 * ```ts
 * if (metric.status === "high" || metric.status === "low") {
 *   await notifyHealthMetricEvent({
 *     userId:   userId,
 *     kind:     "reading_abnormal",
 *     metricId: metric._id,
 *     title:    "High blood glucose detected",
 *     message:  "Your latest glucose reading (140 mg/dL) is above the normal range.",
 *     metadata: { metricType: "glucose", value: 140, unit: "mg/dL", status: "high" },
 *   });
 * }
 * ```
 */
export async function notifyHealthMetricEvent(
  input: MetricNotificationInput
): Promise<INotification> {
  return createNotification("health_metric", METRIC_PRIORITY[input.kind], {
    ...input,
    relatedId:    input.metricId,
    relatedModel: "HealthMetric",
  });
}

// ─── System alerts ────────────────────────────────────────────────────────────

export type SystemAlertKind =
  | "welcome"           // account created — low
  | "password_changed"  // security event — medium
  | "account_updated"   // profile change — low
  | "data_exported"     // export completed — low
  | "security_alert"    // suspicious login etc. — HIGH
  | "app_update";       // new app version — low

const SYSTEM_PRIORITY: Record<SystemAlertKind, NotificationPriorityValue> = {
  welcome:          "low",
  password_changed: "medium",
  account_updated:  "low",
  data_exported:    "low",
  security_alert:   "high",
  app_update:       "low",
};

interface SystemAlertInput extends BaseNotificationInput {
  kind: SystemAlertKind;
}

/**
 * notifySystemAlert
 * Call this from auth routes (register, password change) and system events.
 *
 * ```ts
 * await notifySystemAlert({
 *   userId: user.id,
 *   kind:   "welcome",
 *   title:  "Welcome to MediTrack!",
 *   message:"Your account is ready. Add your first medication to get started.",
 *   actionUrl:   "/medicines",
 *   actionLabel: "Add medicine",
 * });
 * ```
 */
export async function notifySystemAlert(
  input: SystemAlertInput
): Promise<INotification> {
  return createNotification("system", SYSTEM_PRIORITY[input.kind], input);
}

// ─── AI insight (future) ──────────────────────────────────────────────────────

interface AiInsightInput extends BaseNotificationInput {
  insightType: string; // free-form: "adherence_tip", "health_trend", etc.
}

/**
 * notifyAiInsight
 * Placeholder for the AI assistant module.
 * Priority always "medium" unless overridden.
 */
export async function notifyAiInsight(
  input: AiInsightInput
): Promise<INotification> {
  return createNotification("ai_insight", "medium", {
    ...input,
    metadata: { ...input.metadata, insightType: input.insightType },
  });
}

// ─── Unread count helper (used by GET /api/notifications) ────────────────────

/**
 * getUnreadCount
 * Always computed server-side with countDocuments — never derived on the
 * frontend from array length, which would break pagination.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  await connectDB();
  return Notification.countDocuments({
    userId: new (Types.ObjectId as any)(userId),
    read:   false,
  });
}

// ─── Bulk mark-read helper ────────────────────────────────────────────────────

/**
 * markAllRead
 * Marks every unread notification for a user as read in a single updateMany.
 * Returns the number of documents modified.
 */
export async function markAllRead(userId: string): Promise<number> {
  await connectDB();
  const result = await Notification.updateMany(
    { userId: new (Types.ObjectId as any)(userId), read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return result.modifiedCount;
}