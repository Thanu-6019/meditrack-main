import type { AIMessage, AIContext, AIProvider, AIResponse } from "./types";

// ─── Deterministic Response Templates ─────────────────────────────────────────

interface ResponseTemplate {
  keywords: string[];
  build: (ctx: AIContext) => string;
}

const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // ── Adherence / Medication questions ──────────────────────────────────────
  {
    keywords: ["adherence", "medication", "taking", "doses", "pills", "missed"],
    build: (ctx) => {
      const meds = ctx.medicines;
      if (!meds) {
        return "I don't have your medication data available right now. Please make sure your medicines are set up in MediTrack.";
      }
      const { overallPercentage, missedDosesThisWeek, missedDosesThisMonth } =
        meds.adherence;
      const rating =
        overallPercentage >= 90
          ? "excellent"
          : overallPercentage >= 75
          ? "good"
          : overallPercentage >= 60
          ? "fair"
          : "needs improvement";

      return (
        `Your medication adherence this month is **${overallPercentage}%**, which is ${rating}. ` +
        `You have missed **${missedDosesThisWeek} dose(s) this week** and **${missedDosesThisMonth} dose(s) this month**. ` +
        (meds.adherence.streakDays > 0
          ? `You're currently on a **${meds.adherence.streakDays}-day streak** of taking all scheduled doses — keep it up! `
          : "") +
        `Consistent medication adherence is one of the most important factors in managing your health effectively.`
      );
    },
  },

  // ── How am I doing / general health check ─────────────────────────────────
  {
    keywords: ["how am i doing", "overall", "summary", "health check", "doing"],
    build: (ctx) => {
      const meds = ctx.medicines;
      const metrics = ctx.metrics;
      const parts: string[] = ["Here's your overall health summary:\n"];

      if (meds) {
        parts.push(
          `💊 **Medications**: You're taking ${meds.activeCount} active medicine(s) with ${meds.adherence.overallPercentage}% adherence this month.`
        );
      }
      if (metrics) {
        const abnormal = metrics.abnormalReadings.length;
        parts.push(
          `📊 **Health Metrics**: ${
            abnormal === 0
              ? "All recent readings are within normal range."
              : `${abnormal} reading(s) are outside normal range and worth monitoring.`
          }`
        );
      }
      if (ctx.notifications && ctx.notifications.unreadCount > 0) {
        parts.push(
          `🔔 **Alerts**: You have ${ctx.notifications.unreadCount} unread notification(s) that may need your attention.`
        );
      }

      parts.push(
        "\nRemember, I can provide summaries and reminders, but please consult your healthcare provider for medical advice."
      );
      return parts.join("\n");
    },
  },

  // ── Glucose / blood sugar ──────────────────────────────────────────────────
  {
    keywords: ["glucose", "blood sugar", "sugar", "diabetes"],
    build: (ctx) => {
      const glucose = ctx.metrics?.averages?.["glucose"];
      const latest = ctx.metrics?.latestReadings?.["glucose"];

      if (!glucose && !latest) {
        return "I don't see any glucose readings in your MediTrack data. You can log glucose readings in the Health Metrics section.";
      }

      let response =
        `Your average glucose over the last ${glucose?.periodDays ?? 30} days is **${glucose?.value ?? "N/A"} ${glucose?.unit ?? "mg/dL"}**. `;
      if (latest) {
        response += `Your most recent reading was **${latest.value} ${latest.unit}** recorded on ${new Date(
          latest.recordedAt
        ).toLocaleDateString()}. `;
        if (latest.isAbnormal) {
          response +=
            "⚠️ This reading was outside the normal range. Please discuss this with your healthcare provider. ";
        }
      }
      return response;
    },
  },

  // ── Blood pressure ────────────────────────────────────────────────────────
  {
    keywords: ["blood pressure", "bp", "hypertension", "systolic", "diastolic"],
    build: (ctx) => {
      const bp = ctx.metrics?.latestReadings?.["blood_pressure"];
      if (!bp) {
        return "No blood pressure readings found. You can log them in the Health Metrics section of MediTrack.";
      }
      return (
        `Your latest blood pressure reading is **${bp.value} ${bp.unit}**, recorded on ${new Date(
          bp.recordedAt
        ).toLocaleDateString()}. ` +
        (bp.isAbnormal
          ? "⚠️ This reading is outside the normal range. Please consult your healthcare provider."
          : "This reading is within the normal range.")
      );
    },
  },

  // ── Refill / pills remaining ───────────────────────────────────────────────
  {
    keywords: ["refill", "running out", "pills left", "remaining", "supply"],
    build: (ctx) => {
      if (!ctx.medicines) {
        return "I don't have your medication data available to check refill status.";
      }
      const needsRefill = ctx.medicines.medicines.filter((m) => m.refillSoon);
      if (needsRefill.length === 0) {
        return "✅ All your medications appear to have sufficient supply. No refills are needed soon.";
      }
      const list = needsRefill
        .map(
          (m) =>
            `• **${m.name}** — approximately ${m.remainingPills ?? "few"} pill(s) remaining`
        )
        .join("\n");
      return `🔴 The following medications may need a refill soon:\n\n${list}\n\nPlease contact your pharmacy or healthcare provider to arrange refills.`;
    },
  },

  // ── Reminders / schedule ──────────────────────────────────────────────────
  {
    keywords: ["reminder", "schedule", "next dose", "when", "upcoming"],
    build: (ctx) => {
      if (!ctx.medicines?.upcomingDoses?.length) {
        return "No upcoming doses are scheduled in the next period. Make sure your medication schedule is configured in MediTrack.";
      }
      const list = ctx.medicines.upcomingDoses
        .slice(0, 3)
        .map(
          (d) =>
            `• **${d.medicineName}** at ${new Date(d.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        )
        .join("\n");
      return `📅 Your upcoming doses:\n\n${list}`;
    },
  },

  // ── Trends ────────────────────────────────────────────────────────────────
  {
    keywords: ["trend", "improving", "getting better", "worse", "compare", "last month"],
    build: (ctx) => {
      if (!ctx.metrics?.trends || Object.keys(ctx.metrics.trends).length === 0) {
        return "Not enough historical data to show trends yet. Keep logging your health metrics daily for better insights!";
      }
      const trendLines = Object.entries(ctx.metrics.trends)
        .map(([type, trend]) => {
          const emoji =
            trend.direction === "improving"
              ? "📈"
              : trend.direction === "worsening"
              ? "📉"
              : "➡️";
          return `${emoji} **${type}**: ${trend.direction} (${trend.changePercent > 0 ? "+" : ""}${trend.changePercent}% vs last month)`;
        })
        .join("\n");
      return `Here are your health metric trends compared to last month:\n\n${trendLines}`;
    },
  },
];

// ─── Fallback response ─────────────────────────────────────────────────────────

function buildFallback(ctx: AIContext): string {
  const parts: string[] = [
    "I'm your MediTrack AI Health Assistant. I can help you with:\n",
    "• 💊 Medication adherence summaries",
    "• 📊 Health metric trends and readings",
    "• 🔔 Upcoming dose reminders",
    "• 💡 Health insights based on your data",
    "• 🔴 Refill alerts\n",
  ];

  if (ctx.medicines) {
    parts.push(
      `You currently have **${ctx.medicines.activeCount}** active medication(s) with **${ctx.medicines.adherence.overallPercentage}%** adherence.`
    );
  }

  parts.push(
    "\nWhat would you like to know? Try asking 'How is my medication adherence?' or 'Show me my health summary'."
  );

  return parts.join("\n");
}

// ─── Mock Provider ─────────────────────────────────────────────────────────────

export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-v1-deterministic";

  async generateResponse(
    messages: AIMessage[],
    context: AIContext,
    _systemPrompt?: string
  ): Promise<AIResponse> {
    // Simulate a slight processing delay (realistic UX)
    await new Promise((r) => setTimeout(r, 120));

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lowerInput = lastUserMessage.toLowerCase();

    // Find the best matching template
    let bestTemplate: ResponseTemplate | null = null;
    let bestScore = 0;

    for (const template of RESPONSE_TEMPLATES) {
      const score = template.keywords.filter((kw) =>
        lowerInput.includes(kw)
      ).length;
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    const content = bestTemplate
      ? bestTemplate.build(context)
      : buildFallback(context);

    return {
      content,
      model: this.model,
      provider: this.name,
      usage: {
        promptTokens: Math.floor(lowerInput.length / 4),
        completionTokens: Math.floor(content.length / 4),
        totalTokens: Math.floor((lowerInput.length + content.length) / 4),
      },
    };
  }

  async isHealthy(): Promise<boolean> {
    return true; // Mock is always healthy
  }
}