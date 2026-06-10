// src/services/medicine.service.ts

import mongoose from "mongoose";
import Medicine, { IMedicine } from "@/models/Medicine";

export class MedicineService {
  /**
   * Return all active medicines for AI context.
   */
  async getActiveMedicines(userId: string): Promise<IMedicine[]> {
    return Medicine.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean<IMedicine[]>();
  }

  /**
   * Medicines requiring refill soon.
   */
  async getRefillSoonMedicines(userId: string): Promise<IMedicine[]> {
    return Medicine.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      isActive: true,
      refillDate: { $ne: null },
    })
      .sort({ refillDate: 1 })
      .lean<IMedicine[]>();
  }

  /**
   * AI adherence summary.
   *
   * Later replace with MedicationLog calculations.
   */
  async getAdherenceSummary(userId: string) {
    const medicines = await Medicine.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      isActive: true,
    });

    if (!medicines.length) {
      return {
        overallPercentage: 100,
        missedDosesThisWeek: 0,
        missedDosesThisMonth: 0,
        streakDays: 0,
      };
    }

    const avgAdherence =
      medicines.reduce((sum, m) => sum + (m.adherenceRate ?? 100), 0) /
      medicines.length;

    return {
      overallPercentage: Math.round(avgAdherence),
      missedDosesThisWeek: 0,
      missedDosesThisMonth: 0,
      streakDays: 0,
    };
  }
}

export const medicineService = new MedicineService();