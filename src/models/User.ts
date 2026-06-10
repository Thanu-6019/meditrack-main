// src/models/User.ts
// ─────────────────────────────────────────────────────────────────────────────
// User model — full implementation.
// Passwords are stored as bcrypt hashes; the raw field is never exposed.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { Schema, model, models, type Document, type Model } from "mongoose";

// ─── Sub-document interfaces ──────────────────────────────────────────────────

export interface IHealthProfile {
  weight:         number | null;   // kg
  bloodPressure:  string | null;   // e.g. "118/76"
  glucoseLevel:   number | null;   // mg/dL
}

// ─── Main document interface ──────────────────────────────────────────────────

export interface IUser extends Document {
  // ── Identity ──────────────────────────────────────────────────────────────
  name:         string;
  email:        string;

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** bcrypt hash — select: false keeps it out of normal queries */
  password:     string;
  refreshToken: string | null;

  // ── Demographics ──────────────────────────────────────────────────────────
  age:          number | null;
  gender:       "male" | "female" | "other" | "prefer_not_to_say" | null;
  dateOfBirth:  Date   | null;
  phone:        string | null;

  // ── Health profile ────────────────────────────────────────────────────────
  healthProfile: IHealthProfile;

  // ── Account state ─────────────────────────────────────────────────────────
  isActive:   boolean;
  lastLogin:  Date | null;

  // ── Timestamps (added by { timestamps: true }) ────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ─── Health profile sub-schema ────────────────────────────────────────────────

const HealthProfileSchema = new Schema<IHealthProfile>(
  {
    weight:        { type: Number,  default: null },
    bloodPressure: { type: String,  default: null },
    glucoseLevel:  { type: Number,  default: null },
  },
  { _id: false } // no separate _id for the embedded sub-doc
);

// ─── User schema ──────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    // ── Identity ──────────────────────────────────────────────────────────
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
      maxlength: [100, "Name must be 100 characters or fewer"],
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    // ── Auth ──────────────────────────────────────────────────────────────
    password: {
      type:     String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select:   false, // NEVER returned in queries unless explicitly asked
    },
    refreshToken: {
      type:    String,
      default: null,
      select:  false,
    },

    // ── Demographics ──────────────────────────────────────────────────────
    age: {
      type:    Number,
      default: null,
      min:     [0,   "Age cannot be negative"],
      max:     [150, "Age seems too high"],
    },
    gender: {
      type:    String,
      enum:    ["male", "female", "other", "prefer_not_to_say", null],
      default: null,
    },
    dateOfBirth: {
      type:    Date,
      default: null,
    },
    phone: {
      type:    String,
      default: null,
      trim:    true,
    },

    // ── Health profile ────────────────────────────────────────────────────
    healthProfile: {
      type:    HealthProfileSchema,
      default: () => ({ weight: null, bloodPressure: null, glucoseLevel: null }),
    },

    // ── Account state ─────────────────────────────────────────────────────
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLogin: {
      type:    Date,
      default: null,
    },
  },
  {
timestamps: true, // auto-manages createdAt + updatedAt
toJSON: {
  // Strip sensitive fields whenever .toJSON() is called (e.g. res.json())
  transform(_doc, ret: any) { // <-- Adding ': any' stops TypeScript from checking model types
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
  },
},
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// email already has a unique index from `unique: true` above.
// Add any additional compound indexes here as the schema grows.
UserSchema.index({ createdAt: -1 });

// ─── Model export ─────────────────────────────────────────────────────────────
// `models.User || model(...)` prevents "Cannot overwrite model" errors in
// Next.js hot reloads — the model is only compiled once per process.

const User: Model<IUser> =
  (models.User as Model<IUser>) ?? model<IUser>("User", UserSchema);

export default User;