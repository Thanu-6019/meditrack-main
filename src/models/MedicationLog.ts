// src/models/MedicationLog.ts
// ─────────────────────────────────────────────────────────────────────────────
// SKELETON — full fields will be added in the MedicationLog implementation step.
// ─────────────────────────────────────────────────────────────────────────────

import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IMedicationLog extends Document {
  userId:     Types.ObjectId;  // ref → User
  medicineId: Types.ObjectId;  // ref → Medicine
  // TODO: scheduledTime, dueDate, takenAt, status, minutesLate, skippedReason, ...
  createdAt: Date;
  updatedAt: Date;
}

const MedicationLogSchema = new Schema<IMedicationLog>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    medicineId: {
      type:     Schema.Types.ObjectId,
      ref:      "Medicine",
      required: true,
      index:    true,
    },
    // ── Full fields will be added in the MedicationLog implementation step ─
  },
  { timestamps: true }
);

const MedicationLog: Model<IMedicationLog> =
  (models.MedicationLog as Model<IMedicationLog>) ??
  model<IMedicationLog>("MedicationLog", MedicationLogSchema);

export default MedicationLog;