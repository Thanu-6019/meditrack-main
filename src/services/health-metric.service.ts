// src/services/health-metric.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Health metric service — data access layer consumed by the AI ContextBuilder.
//
// Return shapes MUST match context-builder.ts:HealthMetricService exactly.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import HealthMetric from "@/models/HealthMetric";
import connectDB from "@/lib/mongodb";

// ─── Reference ranges for abnormality detection ───────────────────────────────

const NORMAL_RANGES: Record<string, { min: number; max: number }> = {
  heart_rate:        { min: 60,   max: 100  },
  glucose:           { min: 70,   max: 99   },
  oxygen_saturation: { min: 95,   max: 100  },
  bmi:               { min: 18.5, max: 24.9 },
  temperature:       { min: 36.1, max: 37.2 },
  cholesterol:       { min: 0,    max: 200  },
  sleep:             { min: 7,    max: 9    },
};

function severity(
  type: string,
  value: number
): "mild" | "moderate" | "severe" {
  const range = NORMAL_RANGES[type];
  if (!range) return "mild";
  const deviation = Math.max(
    (range.min - value) / range.min,
    (value - range.max) / range.max,
    0
  );
  if (deviation > 0.3) return "severe";
  if (deviation > 0.15) return "moderate";
  return "mild";
}

// ─── HealthMetricService (implements context-builder.ts:HealthMetricService) ──

export class HealthMetricService {
  /**
   * Latest reading per metric type.
   */
  async getLatestReadings(userId: string): Promise<Record<string, {
    value:      number;
    unit:       string;
    recordedAt: Date;
    isAbnormal: boolean;
  }>> {
    await connectDB();

    const metrics = await HealthMetric.aggregate([
      {
        $match: {
          userId:    new (mongoose.Types.ObjectId as any)(userId),
          value:     { $ne: null },
          type:      { $ne: "custom" },
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id:       "$type",
          value:     { $first: "$value" },
          unit:      { $first: "$unit" },
          timestamp: { $first: "$timestamp" },
          status:    { $first: "$status" },
        },
      },
    ]);

    const result: Record<string, { value: number; unit: string; recordedAt: Date; isAbnormal: boolean }> = {};

    for (const m of metrics) {
      result[m._id as string] = {
        value:      m.value as number,
        unit:       (m.unit as string) ?? "",
        recordedAt: m.timestamp as Date,
        isAbnormal: (m.status as string) !== "normal" && (m.status as string) !== "unknown",
      };
    }

    return result;
  }

  /**
   * Average values over the last N days.
   */
  async getAverages(userId: string, periodDays = 30): Promise<Record<string, {
    value:     number;
    unit:      string;
    periodDays: number;
  }>> {
    await connectDB();

    const since = new Date();
    since.setDate(since.getDate() - periodDays);

    const averages = await HealthMetric.aggregate([
      {
        $match: {
          userId:    new (mongoose.Types.ObjectId as any)(userId),
          timestamp: { $gte: since },
          value:     { $ne: null, $type: "number" },
          type:      { $ne: "custom" },
        },
      },
      {
        $group: {
          _id:      "$type",
          avgValue: { $avg: "$value" },
          unit:     { $first: "$unit" },
        },
      },
    ]);

    const result: Record<string, { value: number; unit: string; periodDays: number }> = {};

    for (const a of averages) {
      result[a._id as string] = {
        value:      parseFloat((a.avgValue as number).toFixed(1)),
        unit:       (a.unit as string) ?? "",
        periodDays,
      };
    }

    return result;
  }

  /**
   * Readings outside the normal range, most recent first.
   */
  async getAbnormalReadings(userId: string, limit = 10): Promise<Array<{
    type:       string;
    value:      number;
    unit:       string;
    recordedAt: Date;
    severity:   "mild" | "moderate" | "severe";
  }>> {
    await connectDB();

    const readings = await HealthMetric.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      status: { $in: ["high", "low", "critical"] },
      value:  { $ne: null },
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return readings.map((r) => ({
      type:       r.type,
      value:      r.value as number,
      unit:       r.unit  ?? "",
      recordedAt: r.timestamp,
      severity:   severity(r.type, r.value as number),
    }));
  }

  /**
   * Month-over-month trend per metric type.
   */
  async getTrends(userId: string): Promise<Record<string, {
    direction:     "improving" | "worsening" | "stable";
    changePercent: number;
  }>> {
    await connectDB();

    // Compare most recent 30-day avg against the prior 30-day avg
    const [recent, prior] = await Promise.all([
      this.getAverages(userId, 30),
      this._getAveragesBetween(userId, 60, 30),
    ]);

    const trends: Record<string, { direction: "improving" | "worsening" | "stable"; changePercent: number }> = {};

    for (const type of Object.keys(recent)) {
      const curr = recent[type]?.value;
      const prev = prior[type]?.value;
      if (!curr || !prev || prev === 0) continue;

      const changePercent = parseFloat((((curr - prev) / prev) * 100).toFixed(1));
      const abs = Math.abs(changePercent);

      // "Improving" means the number went down (lower HR, glucose, BP = better)
      // This is a simplification — for sleep, higher is better. A more complete
      // implementation would have per-metric direction preference.
      const direction: "improving" | "worsening" | "stable" =
        abs < 2
          ? "stable"
          : changePercent < 0
          ? "improving"
          : "worsening";

      trends[type] = { direction, changePercent };
    }

    return trends;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _getAveragesBetween(
    userId:       string,
    daysBack:     number,
    daysForward:  number
  ): Promise<Record<string, { value: number; unit: string; periodDays: number }>> {
    await connectDB();

    const to   = new Date();
    to.setDate(to.getDate() - daysForward);
    const from = new Date();
    from.setDate(from.getDate() - daysBack);

    const averages = await HealthMetric.aggregate([
      {
        $match: {
          userId:    new (mongoose.Types.ObjectId as any)(userId),
          timestamp: { $gte: from, $lte: to },
          value:     { $ne: null, $type: "number" },
          type:      { $ne: "custom" },
        },
      },
      {
        $group: {
          _id:      "$type",
          avgValue: { $avg: "$value" },
          unit:     { $first: "$unit" },
        },
      },
    ]);

    const result: Record<string, { value: number; unit: string; periodDays: number }> = {};

    for (const a of averages) {
      result[a._id as string] = {
        value:      parseFloat((a.avgValue as number).toFixed(1)),
        unit:       (a.unit as string) ?? "",
        periodDays: daysBack - daysForward,
      };
    }

    return result;
  }
}

export const healthMetricService = new HealthMetricService();