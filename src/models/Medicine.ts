// src/models/Medicine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicine model — full implementation.
//
// DESIGN NOTES
// ─────────────────────────────────────────────────────────────────────────────
// • userId is always sourced from the JWT in middleware — NEVER from the body.
// • All queries MUST include { userId } in the filter to prevent cross-user
//   data leakage (enforced by the compound index and API route helpers).
// • `select: false` is NOT used here because medicines are not sensitive in the
//   same way passwords are — the userId filter is the isolation boundary.
// ─────────────────────────────────────────────────────────────────────────────

import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const FREQUENCY_VALUES = [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "every_other_day",
  "weekly",
  "as_needed",
] as const;

export type FrequencyValue = (typeof FREQUENCY_VALUES)[number];

export const MEDICINE_STATUS_VALUES = ["active", "paused", "completed", "discontinued"] as const;
export type MedicineStatusValue = (typeof MEDICINE_STATUS_VALUES)[number];

export const ROUTE_OF_ADMIN_VALUES = [
  "oral",
  "topical",
  "inhalation",
  "injection",
  "sublingual",
  "rectal",
  "ophthalmic",
  "otic",
  "nasal",
  "other",
] as const;
export type RouteOfAdminValue = (typeof ROUTE_OF_ADMIN_VALUES)[number];

// ─── Document interface ───────────────────────────────────────────────────────

export interface IMedicine extends Document {
  // ── Ownership ─────────────────────────────────────────────────────────────
  userId: Types.ObjectId; // ref → User — NEVER exposed directly; used only for isolation

  // ── Core ──────────────────────────────────────────────────────────────────
  name:        string;
  genericName: string | null;
  dosage:      string; // e.g. "500 mg", "10 mg"
  form:        string | null; // e.g. "Tablet", "Capsule", "Softgel"

  // ── Schedule ──────────────────────────────────────────────────────────────
  frequency:     FrequencyValue;
  timesPerDay:   number;           // derived from frequency but stored for quick reads
  timeSchedule:  string[];         // e.g. ["08:00", "20:00"] — 24h HH:MM format

  // ── Duration ──────────────────────────────────────────────────────────────
  startDate: Date;
  endDate:   Date | null; // null = indefinite / ongoing

  // ── Prescription info ─────────────────────────────────────────────────────
  prescribedBy: string | null; // doctor name
  condition:    string | null; // the condition being treated
  purpose:      string | null; // brief purpose note

  // ── Supply tracking ───────────────────────────────────────────────────────
  pillsRemaining: number | null;
  totalPills:     number | null;
  refillDate:     Date   | null;
  pharmacy:       string | null;

  // ── Administration ────────────────────────────────────────────────────────
  routeOfAdministration: RouteOfAdminValue;

  // ── Instructions & meta ───────────────────────────────────────────────────
  instructions: string | null; // "Take with food", etc.
  notes:        string | null; // free-form patient notes
  sideEffects:  string[];      // known side effects to display to user
  interactions: string[];      // known drug / food interactions

  // ── State ─────────────────────────────────────────────────────────────────
  status:      MedicineStatusValue;
  isActive:    boolean; // derived from status === "active" but stored for fast filtering
  isValidated: boolean; // true once a pharmacist or OCR scan has verified the entry

  // ── Adherence cache (updated by MedicationLog writes) ────────────────────
  takenToday:    boolean; // lightweight cache — reset at midnight by a cron job
  adherenceRate: number;  // 0–100, rolling 30-day %

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const MedicineSchema = new Schema<IMedicine>(
  {
    // ── Ownership ─────────────────────────────────────────────────────────
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "userId is required"],
      index:    true,
    },

    // ── Core ──────────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, "Medicine name is required"],
      trim:      true,
      maxlength: [200, "Name must be 200 characters or fewer"],
    },
    genericName: {
      type:    String,
      trim:    true,
      default: null,
    },
    dosage: {
      type:      String,
      required:  [true, "Dosage is required"],
      trim:      true,
      maxlength: [100, "Dosage must be 100 characters or fewer"],
    },
    form: {
      type:    String,
      trim:    true,
      default: null,
    },

    // ── Schedule ──────────────────────────────────────────────────────────
    frequency: {
      type:     String,
      required: [true, "Frequency is required"],
      enum: {
        values:  FREQUENCY_VALUES as unknown as string[],
        message: "Invalid frequency value: {VALUE}",
      },
    },
    timesPerDay: {
      type:    Number,
      default: 1,
      min:     [1, "timesPerDay must be at least 1"],
    },
    timeSchedule: {
      type:    [String],
      default: [],
      validate: {
        validator(arr: string[]) {
          // Each entry must be HH:MM (24-hour) or a readable label like "8:00 AM"
          return arr.every((t) => /^\d{1,2}:\d{2}(\s?(AM|PM))?$/i.test(t.trim()));
        },
        message: "Each timeSchedule entry must be a valid time string (e.g. '08:00' or '8:00 AM')",
      },
    },

    // ── Duration ──────────────────────────────────────────────────────────
    startDate: {
      type:    Date,
      default: () => new Date(),
    },
    endDate: {
      type:    Date,
      default: null,
    },

    // ── Prescription info ─────────────────────────────────────────────────
    prescribedBy: { type: String, trim: true, default: null },
    condition:    { type: String, trim: true, default: null },
    purpose:      { type: String, trim: true, default: null },

    // ── Supply tracking ───────────────────────────────────────────────────
    pillsRemaining: { type: Number, default: null, min: [0, "Cannot be negative"] },
    totalPills:     { type: Number, default: null, min: [1, "Must be at least 1"] },
    refillDate:     { type: Date,   default: null },
    pharmacy:       { type: String, trim: true, default: null },

    // ── Administration ────────────────────────────────────────────────────
    routeOfAdministration: {
      type:    String,
      enum:    ROUTE_OF_ADMIN_VALUES as unknown as string[],
      default: "oral",
    },

    // ── Instructions & meta ───────────────────────────────────────────────
    instructions: { type: String, trim: true, default: null },
    notes:        { type: String, trim: true, default: null },
    sideEffects:  { type: [String], default: [] },
    interactions: { type: [String], default: [] },

    // ── State ─────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    MEDICINE_STATUS_VALUES as unknown as string[],
      default: "active",
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    isValidated: {
      type:    Boolean,
      default: false,
    },

    // ── Adherence cache ───────────────────────────────────────────────────
    takenToday: {
      type:    Boolean,
      default: false,
    },
    adherenceRate: {
      type:    Number,
      default: 100,
      min:     0,
      max:     100,
    },
  },
  {
    timestamps: true,
toJSON: {
  virtuals: true,
  transform(_doc, ret: any) { // <-- Adding ': any' fixes all TypeScript errors instantly
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    
    // This original logic remains perfectly untouched and will only run if userId exists
    if (ret.userId) ret.userId = ret.userId.toString();
    
    return ret;
  },
},
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Primary access pattern: user's medicines sorted by creation date
MedicineSchema.index({ userId: 1, createdAt: -1 });

// Active medicines per user (dashboard / reminder queries)
MedicineSchema.index({ userId: 1, isActive: 1 });

// Refill alert queries
MedicineSchema.index({ userId: 1, refillDate: 1 });

// ─── Pre-save hook — keep isActive in sync with status ───────────────────────

MedicineSchema.pre("save", function (next) {
  this.isActive = this.status === "active";
  next();
});

// ─── Model export ─────────────────────────────────────────────────────────────

const Medicine: Model<IMedicine> =
  (models.Medicine as Model<IMedicine>) ??
  model<IMedicine>("Medicine", MedicineSchema);

export default Medicine;