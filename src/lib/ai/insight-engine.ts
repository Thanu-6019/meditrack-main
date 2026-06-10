import type { AIContext, HealthInsight } from "./types";

// ─── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  adherence: {
    excellent: 90,
    good: 75,
    fair: 60,
  },
  missedDosesWarning: 3,
  refillWarningPills: 7,
  trendChangeSignificant: 10, // percent
  glucoseHighAverage: 140,    // mg/dL
  glucoseLowAverage: 70,
  bpSystolicHigh: 130,        // mmHg
  heartRateHigh: 100,         // bpm
  heartRateLow: 50,
} as const;

// ─── Insight Generators ────────────────────────────────────────────────────────

function generateAdherenceInsights(ctx: AIContext): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const meds = ctx.medicines;
  if (!meds) return insights;

  const { overallPercentage, missedDosesThisWeek, missedDosesThisMonth, streakDays } =
    meds.adherence;

  // Overall adherence rating
  if (overallPercentage >= THRESHOLDS.adherence.excellent) {
    insights.push({
      category: "adherence",
      severity: "info",
      message: `Great job! Your medication adherence is ${overallPercentage}% this month.`,
      recommendation: "Keep up the excellent routine — consistency is key to effective treatment.",
    });
  } else if (overallPercentage >= THRESHOLDS.adherence.good) {
    insights.push({
      category: "adherence",
      severity: "info",
      message: `Your medication adherence is ${overallPercentage}% this month — good progress.`,
      recommendation: "A few missed doses can reduce treatment effectiveness. Setting reminders may help.",
      data: { adherencePercent: overallPercentage },
    });
  } else if (overallPercentage >= THRESHOLDS.adherence.fair) {
    insights.push({
      category: "adherence",
      severity: "warning",
      message: `Your medication adherence is ${overallPercentage}% — below the recommended threshold.`,
      recommendation:
        "Try enabling MediTrack dose reminders or ask your healthcare provider about strategies to improve adherence.",
      data: { adherencePercent: overallPercentage },
    });
  } else {
    insights.push({
      category: "adherence",
      severity: "critical",
      message: `Your medication adherence has dropped to ${overallPercentage}% this month.`,
      recommendation:
        "This level of missed doses may affect your treatment outcomes. Please discuss with your healthcare provider at your next visit.",
      data: { adherencePercent: overallPercentage },
    });
  }

  // Missed doses this week
  if (missedDosesThisWeek >= THRESHOLDS.missedDosesWarning) {
    insights.push({
      category: "adherence",
      severity: "warning",
      message: `You have missed ${missedDosesThisWeek} dose(s) this week.`,
      recommendation: "Check your upcoming schedule and enable notifications to stay on track.",
      data: { missedDosesThisWeek },
    });
  }

  // Monthly missed doses
  if (missedDosesThisMonth > 0 && overallPercentage < THRESHOLDS.adherence.excellent) {
    insights.push({
      category: "adherence",
      severity: "info",
      message: `You have missed ${missedDosesThisMonth} dose(s) this month in total.`,
      data: { missedDosesThisMonth },
    });
  }

  // Streak celebration
  if (streakDays >= 7) {
    insights.push({
      category: "adherence",
      severity: "info",
      message: `🎉 You're on a ${streakDays}-day adherence streak!`,
      recommendation: "Maintaining this streak will maximize your medication's effectiveness.",
      data: { streakDays },
    });
  }

  return insights;
}

function generateMetricInsights(ctx: AIContext): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const metrics = ctx.metrics;
  if (!metrics) return insights;

  // Abnormal readings summary
  if (metrics.abnormalReadings.length > 0) {
    const critical = metrics.abnormalReadings.filter((r) => r.severity === "severe");
    const moderate = metrics.abnormalReadings.filter((r) => r.severity === "moderate");

    if (critical.length > 0) {
      insights.push({
        category: "metrics",
        severity: "critical",
        message: `${critical.length} health reading(s) are significantly outside the normal range.`,
        recommendation:
          "Please discuss these readings with your healthcare provider as soon as possible.",
        data: { criticalReadings: critical.map((r) => `${r.type}: ${r.value} ${r.unit}`) },
      });
    } else if (moderate.length > 0) {
      insights.push({
        category: "metrics",
        severity: "warning",
        message: `${moderate.length} health reading(s) are above or below normal range.`,
        recommendation:
          "Monitor these values and mention them at your next healthcare appointment.",
        data: { readings: moderate.map((r) => `${r.type}: ${r.value} ${r.unit}`) },
      });
    }
  }

  // Glucose-specific insight
  const glucoseAvg = metrics.averages?.["glucose"];
  if (glucoseAvg) {
    if (glucoseAvg.value > THRESHOLDS.glucoseHighAverage) {
      insights.push({
        category: "metrics",
        severity: "warning",
        message: `Your average glucose is ${glucoseAvg.value} ${glucoseAvg.unit} over the last ${glucoseAvg.periodDays} days — above the typical target range.`,
        recommendation:
          "Discuss your glucose levels with your healthcare provider to review your management plan.",
        data: { glucoseAverage: glucoseAvg.value, unit: glucoseAvg.unit },
      });
    } else if (glucoseAvg.value < THRESHOLDS.glucoseLowAverage) {
      insights.push({
        category: "metrics",
        severity: "warning",
        message: `Your average glucose is ${glucoseAvg.value} ${glucoseAvg.unit} — below the typical target range.`,
        recommendation: "Low glucose averages should be reviewed with your healthcare provider.",
        data: { glucoseAverage: glucoseAvg.value },
      });
    }
  }

  return insights;
}

function generateTrendInsights(ctx: AIContext): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const metrics = ctx.metrics;
  if (!metrics?.trends) return insights;

  for (const [metricType, trend] of Object.entries(metrics.trends)) {
    const absChange = Math.abs(trend.changePercent);

    if (absChange >= THRESHOLDS.trendChangeSignificant) {
      const formatted = metricType.replace(/_/g, " ");
      if (trend.direction === "worsening") {
        insights.push({
          category: "trend",
          severity: "warning",
          message: `Your ${formatted} readings have worsened by ${absChange}% compared to last month.`,
          recommendation: `Monitor your ${formatted} closely and discuss the trend with your healthcare provider.`,
          data: { metricType, changePercent: trend.changePercent },
        });
      } else if (trend.direction === "improving") {
        insights.push({
          category: "trend",
          severity: "info",
          message: `Your ${formatted} has improved by ${absChange}% compared to last month — excellent progress!`,
          data: { metricType, changePercent: trend.changePercent },
        });
      }
    }
  }

  return insights;
}

function generateRefillInsights(ctx: AIContext): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const meds = ctx.medicines;
  if (!meds) return insights;

  const needsRefill = meds.medicines.filter((m) => m.refillSoon);

  if (needsRefill.length > 0) {
    for (const med of needsRefill) {
      insights.push({
        category: "refill",
        severity:
          (med.remainingPills ?? 0) <= 3 ? "critical" : "warning",
        message: `${med.name} has only ${med.remainingPills ?? "a few"} pill(s) remaining.`,
        recommendation: `Contact your pharmacy or healthcare provider to arrange a refill for ${med.name} soon.`,
        data: { medicineName: med.name, remainingPills: med.remainingPills },
      });
    }
  }

  return insights;
}

// ─── Main Engine ───────────────────────────────────────────────────────────────

export class InsightEngine {
  /**
   * Generate all applicable insights for a user's context.
   * Insights are sorted: critical → warning → info.
   */
  generate(context: AIContext): HealthInsight[] {
    const all: HealthInsight[] = [
      ...generateAdherenceInsights(context),
      ...generateMetricInsights(context),
      ...generateTrendInsights(context),
      ...generateRefillInsights(context),
    ];

    // Sort: critical first, then warning, then info
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return all.sort((a, b) => (order[a.severity] ?? 2) - (order[b.severity] ?? 2));
  }

  /**
   * Format insights as a human-readable string block
   * to include in the AI response context.
   */
  formatForPrompt(insights: HealthInsight[]): string {
    if (insights.length === 0) return "No specific insights at this time.";

    return insights
      .map((i) => {
        const prefix =
          i.severity === "critical"
            ? "🔴"
            : i.severity === "warning"
            ? "🟡"
            : "🟢";
        return `${prefix} [${i.category.toUpperCase()}] ${i.message}${
          i.recommendation ? `\n   → ${i.recommendation}` : ""
        }`;
      })
      .join("\n\n");
  }
}