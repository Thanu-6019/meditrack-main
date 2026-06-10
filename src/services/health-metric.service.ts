// src/services/health-metric.service.ts

import mongoose from "mongoose";
import HealthMetric, {
  IHealthMetric,
} from "@/models/HealthMetric";

export class HealthMetricService {
  /**
   * Latest metric per type.
   */
  async getLatestMetrics(userId: string) {
    const metrics = await HealthMetric.aggregate([
      {
        $match: {
          userId: new (mongoose.Types.ObjectId as any)(userId),
        },
      },
      {
        $sort: {
          timestamp: -1,
        },
      },
      {
        $group: {
          _id: "$type",
          latest: { $first: "$$ROOT" },
        },
      },
    ]);

    const result: Record<string, any> = {};

    for (const metric of metrics) {
      result[metric._id] = metric.latest;
    }

    return result;
  }

  /**
   * Average metric values.
   */
  async getMetricAverages(
    userId: string,
    days = 30
  ) {
    const start = new Date();
    start.setDate(start.getDate() - days);

    const averages = await HealthMetric.aggregate([
      {
        $match: {
          userId: new (mongoose.Types.ObjectId as any)(userId),
          timestamp: { $gte: start },
          value: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$type",
          avgValue: { $avg: "$value" },
          unit: { $first: "$unit" },
        },
      },
    ]);

    const result: Record<string, any> = {};

    for (const avg of averages) {
      result[avg._id] = {
        value: Number(avg.avgValue.toFixed(1)),
        unit: avg.unit,
        periodDays: days,
      };
    }

    return result;
  }

  /**
   * Trend calculation.
   */
  async getMetricTrends(userId: string) {
    const latest = await this.getMetricAverages(userId, 30);
    const previous = await this.getMetricAverages(userId, 60);

    const trends: Record<string, any> = {};

    for (const metricType of Object.keys(latest)) {
      const current = latest[metricType]?.value;
      const old = previous[metricType]?.value;

      if (!current || !old) continue;

      const changePercent =
        ((current - old) / old) * 100;

      trends[metricType] = {
        direction:
          changePercent > 0
            ? "worsening"
            : changePercent < 0
            ? "improving"
            : "stable",
        changePercent: Number(changePercent.toFixed(1)),
      };
    }

    return trends;
  }

  /**
   * Metrics outside normal range.
   */
  async getAbnormalReadings(userId: string) {
    const readings = await HealthMetric.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      status: {
        $in: ["high", "low", "critical"],
      },
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean<IHealthMetric[]>();

    return readings.map((r) => ({
      type: r.type,
      value: r.displayValue,
      unit: r.unit,
      severity:
        r.status === "critical"
          ? "severe"
          : "moderate",
    }));
  }
}

export const healthMetricService =
  new HealthMetricService();