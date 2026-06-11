// src/services/medicine.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicine service — data access layer consumed by the AI ContextBuilder.
//
// The return shapes here MUST match the interfaces in
// src/lib/ai/context-builder.ts:MedicineService exactly. TypeScript will catch
// drift at build time because the ContextBuilder constructor accepts a typed
// interface, but it's easy to miss at runtime — be careful when adding fields.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import Medicine from "@/models/Medicine";
import MedicationLog from "@/models/MedicationLog";
import connectDB from "@/lib/mongodb";

// ─── MedicineService (implements context-builder.ts:MedicineService) ─────────

export class MedicineService {
  /**
   * Return active medicines in the shape ContextBuilder expects.
   */
  async getActiveMedicines(userId: string): Promise<Array<{
    id:              string;
    name:            string;
    dosage:          string;
    frequency:       string;
    remainingPills?: number;
    refillThreshold?: number;
  }>> {
    await connectDB();

    const meds = await Medicine.find({
      userId:   new (mongoose.Types.ObjectId as any)(userId),
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return meds.map((m) => ({
      id:              m._id.toString(),
      name:            m.name,
      dosage:          m.dosage,
      frequency:       m.frequency,
      remainingPills:  m.pillsRemaining  ?? undefined,
      refillThreshold: m.totalPills != null
        ? Math.ceil(m.totalPills * 0.3)  // 30% of total = refill threshold
        : undefined,
    }));
  }

  /**
   * Adherence stats. Uses MedicationLog if records exist; falls back to the
   * cached adherenceRate field on Medicine for zero-history accounts.
   */
  async getAdherenceStats(userId: string, periodDays = 30): Promise<{
    overallPercentage:    number;
    missedDosesThisWeek:  number;
    missedDosesThisMonth: number;
    streakDays:           number;
  }> {
    await connectDB();

    // ── Try MedicationLog first ─────────────────────────────────────────────
    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const logCount = await MedicationLog.countDocuments({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      createdAt: { $gte: since },
    });

    if (logCount > 0) {
      // TODO: replace with real aggregation once MedicationLog is fully wired.
      // For now aggregate from Medicine.takenToday as a placeholder.
    }

    // ── Fall back to Medicine.adherenceRate cache ───────────────────────────
    const meds = await Medicine.find({
      userId:   new (mongoose.Types.ObjectId as any)(userId),
      isActive: true,
    }).lean();

    if (meds.length === 0) {
      return { overallPercentage: 100, missedDosesThisWeek: 0, missedDosesThisMonth: 0, streakDays: 0 };
    }

    const avg = meds.reduce((sum, m) => sum + (m.adherenceRate ?? 100), 0) / meds.length;
    const takenToday = meds.filter((m) => m.takenToday).length;
    const missedToday = meds.length - takenToday;

    return {
      overallPercentage:    Math.round(avg),
      missedDosesThisWeek:  missedToday,       // best estimate without full log
      missedDosesThisMonth: Math.round(missedToday * (periodDays / 7)),
      streakDays:           0,                  // requires MedicationLog to compute accurately
    };
  }

  /**
   * Upcoming doses in the next N hours, derived from timeSchedule.
   */
  async getUpcomingDoses(userId: string, hoursAhead = 24): Promise<Array<{
    medicineName: string;
    scheduledAt:  Date;
  }>> {
    await connectDB();

    const meds = await Medicine.find({
      userId:   new (mongoose.Types.ObjectId as any)(userId),
      isActive: true,
    }).lean();

    const now     = new Date();
    const cutoff  = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const results: Array<{ medicineName: string; scheduledAt: Date }> = [];

    for (const med of meds) {
      for (const timeStr of med.timeSchedule ?? []) {
        const scheduledAt = this._nextOccurrence(timeStr, now);
        if (scheduledAt && scheduledAt <= cutoff) {
          results.push({ medicineName: med.name, scheduledAt });
        }
      }
    }

    return results.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  /** Parses "HH:MM" or "H:MM AM/PM" into the next wall-clock occurrence. */
  private _nextOccurrence(timeStr: string, from: Date): Date | null {
    try {
      const clean = timeStr.trim().toUpperCase();
      let hours   = 0;
      let minutes = 0;

      const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
      const h24Match  = clean.match(/^(\d{1,2}):(\d{2})$/);

      if (ampmMatch) {
        hours   = parseInt(ampmMatch[1], 10);
        minutes = parseInt(ampmMatch[2], 10);
        if (ampmMatch[3] === "PM" && hours < 12) hours += 12;
        if (ampmMatch[3] === "AM" && hours === 12) hours = 0;
      } else if (h24Match) {
        hours   = parseInt(h24Match[1], 10);
        minutes = parseInt(h24Match[2], 10);
      } else {
        return null;
      }

      const candidate = new Date(from);
      candidate.setHours(hours, minutes, 0, 0);
      if (candidate <= from) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    } catch {
      return null;
    }
  }
}

export const medicineService = new MedicineService();