// src/models/HealthMetric.ts
// ─────────────────────────────────────────────────────────────────────────────
// HealthMetric model — full implementation.
//
// DESIGN PHILOSOPHY
// ─────────────────────────────────────────────────────────────────────────────
// • Event-sourced: every reading is an immutable append. Nothing is ever
//   overwritten. This gives us full history for charts and future ML features.
//
// • value + systolic/diastolic split: blood pressure ("120/80") is stored as
//   two separate numeric fields so server-side math (avg, min, max) works
//   cleanly without string parsing at query time.
//
// • displayValue: a pre-computed human-readable string stored alongside the
//   raw numbers so the frontend never has to format values itself.
//
// • Compound index on { userId, type, timestamp }: covers the single most
//   critical query — "give me all weight readings for user X between date A
//   and date B, sorted oldest-first" — in one index scan with no sort stage.
// ─────────────────────────────────────────────────────────────────────────────

import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const METRIC_TYPES = [
  "weight",
  "blood_pressure",
  "glucose",
  "heart_rate",
  "oxygen_saturation",
  "temperature",
  "cholesterol",
  "bmi",
  "sleep",
  "custom",
] as const;

export type MetricType = (typeof METRIC_TYPES)[number];

/** Types that have a meaningful single numeric value for aggregation. */
export const NUMERIC_METRIC_TYPES = new Set<MetricType>([
  "weight",
  "glucose",
  "heart_rate",
  "oxygen_saturation",
  "temperature",
  "cholesterol",
  "bmi",
  "sleep",
]);

/** Types that carry two values (systolic + diastolic). */
export const COMPOUND_METRIC_TYPES = new Set<MetricType>(["blood_pressure"]);

export const METRIC_STATUS_VALUES = ["normal", "low", "high", "critical", "unknown"] as const;
export type MetricStatusValue = (typeof METRIC_STATUS_VALUES)[number];

export const DATA_SOURCES = ["manual", "device", "ocr_scan", "import", "api"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

// ─── Default units per type ───────────────────────────────────────────────────

export const DEFAULT_UNITS: Partial<Record<MetricType, string>> = {
  weight:             "kg",
  blood_pressure:     "mmHg",
  glucose:            "mg/dL",
  heart_rate:         "bpm",
  oxygen_saturation:  "%",
  temperature:        "°C",
  cholesterol:        "mg/dL",
  bmi:                "kg/m²",
  sleep:              "hours",
};

// ─── Document interface ───────────────────────────────────────────────────────

export interface IHealthMetric extends Document {
  // ── Ownership ─────────────────────────────────────────────────────────────
  userId: Types.ObjectId;

  // ── Classification ────────────────────────────────────────────────────────
  type:        MetricType;
  customLabel: string | null; // used when type === "custom"

  // ── Values ────────────────────────────────────────────────────────────────
  /**
   * Primary numeric value.
   * For blood_pressure this holds the SYSTOLIC reading.
   * For custom string-only metrics this is null.
   */
  value:     number | null;

  /**
   * Diastolic component — only populated for blood_pressure.
   * Storing separately avoids string-splitting in aggregation pipelines.
   */
  systolic:  number | null; // same as value for BP (redundant but explicit)
  diastolic: number | null;

  unit: string | null;

  /**
   * Pre-formatted display string stored at write time.
   * e.g. "120/80 mmHg", "72 bpm", "71.2 kg"
   * Frontend reads this directly — no client-side formatting needed.
   */
  displayValue: string;

  // ── Context ───────────────────────────────────────────────────────────────
  timestamp:  Date;          // when the reading was actually taken
  notes:      string | null;
  tags:       string[];      // e.g. ["fasting", "post-exercise", "morning"]
  source:     DataSource;
  deviceId:   string | null; // for wearable/device integration

  // ── Clinical ──────────────────────────────────────────────────────────────
  status: MetricStatusValue; // set by the API based on reference ranges

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ─── Reference ranges (used to compute `status` at write time) ────────────────

interface Range { min: number; max: number }
const NORMAL_RANGES: Partial<Record<MetricType, Range>> = {
  heart_rate:         { min: 60,  max: 100  },
  glucose:            { min: 70,  max: 99   },
  oxygen_saturation:  { min: 95,  max: 100  },
  bmi:                { min: 18.5, max: 24.9 },
  temperature:        { min: 36.1, max: 37.2 },
  weight:             { min: 0,   max: 9999  }, // no universal range
  cholesterol:        { min: 0,   max: 200   },
  sleep:              { min: 7,   max: 9     },
};

function computeStatus(type: MetricType, value: number | null): MetricStatusValue {
  if (value === null) return "unknown";
  const range = NORMAL_RANGES[type];
  if (!range) return "unknown";
  if (value < range.min) return "low";
  if (value > range.max) return "high";
  return "normal";
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const HealthMetricSchema = new Schema<IHealthMetric>(
  {
    // ── Ownership ─────────────────────────────────────────────────────────
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "userId is required"],
      index:    true,
    },

    // ── Classification ────────────────────────────────────────────────────
    type: {
      type:     String,
      required: [true, "type is required"],
      enum: {
        values:  METRIC_TYPES as unknown as string[],
        message: "Invalid metric type: {VALUE}. Allowed: " + METRIC_TYPES.join(", "),
      },
    },
    customLabel: {
      type:    String,
      trim:    true,
      default: null,
    },

    // ── Values ────────────────────────────────────────────────────────────
    value: {
      type:    Number,
      default: null,
    },
    systolic: {
      type:    Number,
      default: null,
    },
    diastolic: {
      type:    Number,
      default: null,
    },
    unit: {
      type:    String,
      trim:    true,
      default: null,
    },
    displayValue: {
      type:    String,
      default: "",
    },

    // ── Context ───────────────────────────────────────────────────────────
    timestamp: {
      type:    Date,
      default: () => new Date(),
    },
    notes: {
      type:      String,
      trim:      true,
      default:   null,
      maxlength: [500, "Notes must be 500 characters or fewer"],
    },
    tags: {
      type:    [String],
      default: [],
    },
    source: {
      type:    String,
      enum:    DATA_SOURCES as unknown as string[],
      default: "manual",
    },
    deviceId: {
      type:    String,
      default: null,
    },

    // ── Clinical ──────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    METRIC_STATUS_VALUES as unknown as string[],
      default: "unknown",
    },
  },
  {
    timestamps: true,
toJSON: {
  virtuals: true,
  transform(_doc, ret: any) { // added : any
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (ret.userId) ret.userId = ret.userId.toString();
    return ret;
  },
},
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// PRIMARY: time-series queries — "all glucose readings for user X in range [A,B]"
HealthMetricSchema.index({ userId: 1, type: 1, timestamp: -1 });

// SECONDARY: dashboard "latest reading per type" — sort by timestamp desc
HealthMetricSchema.index({ userId: 1, timestamp: -1 });

// TERTIARY: status-based queries — "all high readings for user X"
HealthMetricSchema.index({ userId: 1, status: 1 });

// ─── Pre-validate hook — normalise + derive computed fields ──────────────────

HealthMetricSchema.pre("validate", function (next) {
  // 1. Auto-fill unit from defaults if not provided
  if (!this.unit && this.type && DEFAULT_UNITS[this.type]) {
    this.unit = DEFAULT_UNITS[this.type] ?? null;
  }

  // 2. Blood pressure: parse "120/80" string into systolic + diastolic
  //    Accepts value as a number (systolic) if diastolic is also provided,
  //    OR a string like "120/80" passed via the incoming body pre-cast.
  if (this.type === "blood_pressure") {
    // If caller passed systolic/diastolic directly, mirror to value
    if (this.systolic !== null && this.diastolic !== null) {
      this.value = this.systolic;
    }
    // Build display string
    if (this.systolic !== null && this.diastolic !== null) {
      this.displayValue = `${this.systolic}/${this.diastolic} ${this.unit ?? "mmHg"}`;
    }
  } else if (this.value !== null) {
    this.displayValue = `${this.value} ${this.unit ?? ""}`.trim();
  }

  // 3. Derive clinical status
  this.status = computeStatus(this.type, this.value);

  next();
});

// ─── Model export ─────────────────────────────────────────────────────────────

const HealthMetric: Model<IHealthMetric> =
  (models.HealthMetric as Model<IHealthMetric>) ??
  model<IHealthMetric>("HealthMetric", HealthMetricSchema);

export default HealthMetric;