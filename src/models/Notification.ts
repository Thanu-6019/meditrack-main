// src/models/Notification.ts
// ─────────────────────────────────────────────────────────────────────────────
// Notification model — production implementation.
//
// DESIGN DECISIONS
// ─────────────────────────────────────────────────────────────────────────────
// • `message` not `body` — matches the spec and keeps parity with the
//   NotificationDTO in src/types/index.ts.
//
// • `metadata` (Schema.Types.Mixed) — schemaless escape hatch so any module
//   (medicines, health metrics, AI) can attach domain context without a
//   schema migration. API never interprets this; it only passes it through.
//
// • `isDelivered` + `channel` — real-time/push tracking hooks for the future.
//   Present in the schema now so adding a WebSocket / push worker later
//   requires zero migration.  See notification.service.ts for the upgrade path.
//
// INDEX STRATEGY
// ─────────────────────────────────────────────────────────────────────────────
// { userId, read, createdAt }
//   → "all unread for user X newest-first"  (leftmost prefix: userId + read)
//   → "all for user X newest-first"         (leftmost prefix: userId only)
//
// { userId, type, createdAt }
//   → "medicine alerts for user X"
//
// { channel, isDelivered, createdAt }
//   → delivery worker retry queue
// ─────────────────────────────────────────────────────────────────────────────

import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "medicine",       // dose reminders, taken confirmations, added / updated / removed
  "health_metric",  // vitals out of normal range
  "system",         // account / app / onboarding events
  "alert",          // urgent clinical alerts (high BP, critical glucose, etc.)
  "ai_insight",     // future: AI-generated health recommendations
] as const;

export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ["low", "medium", "high"] as const;
export type NotificationPriorityValue = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "push", "email"] as const;
export type NotificationChannelValue = (typeof NOTIFICATION_CHANNELS)[number];

// ─── Document interface ───────────────────────────────────────────────────────

export interface INotification extends Document {
  // ── Ownership ─────────────────────────────────────────────────────────────
  userId: Types.ObjectId;

  // ── Content ───────────────────────────────────────────────────────────────
  title:    string;
  message:  string;
  type:     NotificationTypeValue;
  priority: NotificationPriorityValue;

  // ── State ─────────────────────────────────────────────────────────────────
  read:   boolean;
  readAt: Date | null;

  // ── CTA ───────────────────────────────────────────────────────────────────
  actionUrl:   string | null;
  actionLabel: string | null;

  // ── Source reference ──────────────────────────────────────────────────────
  /** ObjectId of the document that triggered this notification */
  relatedId:    Types.ObjectId | null;
  relatedModel: "Medicine" | "MedicationLog" | "HealthMetric" | null;

  // ── Arbitrary domain context — passed through untouched ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null;

  // ── Real-time / push tracking (not yet wired — schema-only hooks) ─────────
  isDelivered: boolean;
  channel:     NotificationChannelValue;

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "userId is required"],
      index:    true,
    },

    title: {
      type:      String,
      required:  [true, "title is required"],
      trim:      true,
      maxlength: [200, "title must be 200 characters or fewer"],
    },
    message: {
      type:      String,
      required:  [true, "message is required"],
      trim:      true,
      maxlength: [1000, "message must be 1000 characters or fewer"],
    },
    type: {
      type:    String,
      enum: {
        values:  NOTIFICATION_TYPES as unknown as string[],
        message: "Invalid notification type: {VALUE}",
      },
      default: "system",
    },
    priority: {
      type:    String,
      enum: {
        values:  NOTIFICATION_PRIORITIES as unknown as string[],
        message: "Invalid priority: {VALUE}",
      },
      default: "medium",
    },

    read: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    readAt: {
      type:    Date,
      default: null,
    },

    actionUrl:   { type: String, default: null },
    actionLabel: { type: String, default: null },

    relatedId:    { type: Schema.Types.ObjectId, default: null },
    relatedModel: {
      type:    String,
      enum:    ["Medicine", "MedicationLog", "HealthMetric", null],
      default: null,
    },

    metadata: { type: Schema.Types.Mixed, default: null },

    isDelivered: { type: Boolean, default: false },
    channel: {
      type:    String,
      enum:    NOTIFICATION_CHANNELS as unknown as string[],
      default: "in_app",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.userId)    ret.userId    = ret.userId.toString();
        if (ret.relatedId) ret.relatedId = ret.relatedId.toString();
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// PRIMARY  : unread inbox — most-hit query in the app
// Covers   : { userId }         ORDER BY createdAt DESC
//          : { userId, read }   ORDER BY createdAt DESC
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// SECONDARY: type-filtered inbox — "show me only medicine alerts"
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// TERTIARY : delivery worker retry queue (future push/email)
NotificationSchema.index({ channel: 1, isDelivered: 1, createdAt: 1 });

// ─── Middleware — auto-set readAt when read flips to true ─────────────────────

NotificationSchema.pre("save", function (next) {
  if (this.isModified("read")) {
    this.readAt = this.read ? new Date() : null;
  }
  next();
});

NotificationSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (update && (update as { read?: boolean }).read === true) {
    (update as Record<string, unknown>).readAt = new Date();
  }
  next();
});

// ─── Model export ─────────────────────────────────────────────────────────────

const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ??
  model<INotification>("Notification", NotificationSchema);

export default Notification;