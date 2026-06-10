import type {
  AIContext,
  AIMessage,
  MedicineContext,
  HealthMetricContext,
  NotificationContext,
  UserContext,
} from "./types";

// ─── Service Layer Interfaces ──────────────────────────────────────────────────
// These mirror the data shapes returned by your existing service modules.
// The AI layer NEVER queries MongoDB directly.

export interface MedicineService {
  getActiveMedicines(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      dosage: string;
      frequency: string;
      remainingPills?: number;
      refillThreshold?: number;
    }>
  >;
  getAdherenceStats(
    userId: string,
    periodDays?: number
  ): Promise<{
    overallPercentage: number;
    missedDosesThisWeek: number;
    missedDosesThisMonth: number;
    streakDays: number;
  }>;
  getUpcomingDoses(
    userId: string,
    hoursAhead?: number
  ): Promise<Array<{ medicineName: string; scheduledAt: Date }>>;
}

export interface HealthMetricService {
  getLatestReadings(
    userId: string
  ): Promise<
    Record<
      string,
      { value: number; unit: string; recordedAt: Date; isAbnormal: boolean }
    >
  >;
  getAverages(
    userId: string,
    periodDays?: number
  ): Promise<Record<string, { value: number; unit: string; periodDays: number }>>;
  getAbnormalReadings(
    userId: string,
    limit?: number
  ): Promise<
    Array<{
      type: string;
      value: number;
      unit: string;
      recordedAt: Date;
      severity: "mild" | "moderate" | "severe";
    }>
  >;
  getTrends(
    userId: string
  ): Promise<
    Record<
      string,
      { direction: "improving" | "worsening" | "stable"; changePercent: number }
    >
  >;
}

export interface NotificationService {
  getUnreadCount(userId: string): Promise<number>;
  getRecentAlerts(
    userId: string,
    limit?: number
  ): Promise<
    Array<{
      type: string;
      message: string;
      createdAt: Date;
      priority: "low" | "medium" | "high";
    }>
  >;
  getPendingActions(userId: string): Promise<string[]>;
}

// ─── Context Builder ───────────────────────────────────────────────────────────

export class ContextBuilder {
  constructor(
    private readonly medicineService: MedicineService,
    private readonly metricService: HealthMetricService,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Build the full AIContext for a given user.
   * All data is fetched in parallel to minimize latency.
   * Any individual section failure is caught and returns null
   * so the assistant can still respond with partial context.
   */
  async build(
    userId: string,
    conversationHistory: AIMessage[] = [],
    options: { includeMedicines?: boolean; includeMetrics?: boolean; includeNotifications?: boolean } = {}
  ): Promise<AIContext> {
    const {
      includeMedicines = true,
      includeMetrics = true,
      includeNotifications = true,
    } = options;

    const user: UserContext = { userId };

    const [medicines, metrics, notifications] = await Promise.all([
      includeMedicines
        ? this.buildMedicineContext(userId).catch((e) => {
            console.warn("[ContextBuilder] medicines section failed:", e.message);
            return null;
          })
        : Promise.resolve(null),

      includeMetrics
        ? this.buildMetricContext(userId).catch((e) => {
            console.warn("[ContextBuilder] metrics section failed:", e.message);
            return null;
          })
        : Promise.resolve(null),

      includeNotifications
        ? this.buildNotificationContext(userId).catch((e) => {
            console.warn("[ContextBuilder] notifications section failed:", e.message);
            return null;
          })
        : Promise.resolve(null),
    ]);

    return {
      user,
      medicines,
      metrics,
      notifications,
      generatedAt: new Date(),
      conversationHistory,
    };
  }

  // ── Medicine Context ─────────────────────────────────────────────────────────

  private async buildMedicineContext(userId: string): Promise<MedicineContext> {
    const [activeMeds, adherence, upcomingDoses] = await Promise.all([
      this.medicineService.getActiveMedicines(userId),
      this.medicineService.getAdherenceStats(userId, 30),
      this.medicineService.getUpcomingDoses(userId, 24),
    ]);

    const medicines = activeMeds.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      remainingPills: m.remainingPills,
      refillSoon:
        m.remainingPills !== undefined &&
        m.refillThreshold !== undefined &&
        m.remainingPills <= m.refillThreshold,
    }));

    return {
      activeCount: medicines.length,
      medicines,
      adherence,
      upcomingDoses,
    };
  }

  // ── Metric Context ───────────────────────────────────────────────────────────

  private async buildMetricContext(userId: string): Promise<HealthMetricContext> {
    const [latestReadings, averages, abnormalReadings, trends] =
      await Promise.all([
        this.metricService.getLatestReadings(userId),
        this.metricService.getAverages(userId, 30),
        this.metricService.getAbnormalReadings(userId, 10),
        this.metricService.getTrends(userId),
      ]);

    return {
      latestReadings,
      averages,
      abnormalReadings,
      trends,
    };
  }

  // ── Notification Context ─────────────────────────────────────────────────────

  private async buildNotificationContext(
    userId: string
  ): Promise<NotificationContext> {
    const [unreadCount, recentAlerts, pendingActions] = await Promise.all([
      this.notificationService.getUnreadCount(userId),
      this.notificationService.getRecentAlerts(userId, 5),
      this.notificationService.getPendingActions(userId),
    ]);

    return {
      unreadCount,
      recentAlerts,
      pendingActions,
    };
  }

  /**
   * Serialize context to a compact JSON string for the LLM.
   * Strips fields not useful for the model (internal IDs, timestamps).
   */
  static serialize(context: AIContext): string {
    const payload: Record<string, unknown> = {};

    if (context.medicines) {
      payload.medicines = {
        activeCount: context.medicines.activeCount,
        adherence: context.medicines.adherence,
        medicines: context.medicines.medicines.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          ...(m.remainingPills !== undefined && { remainingPills: m.remainingPills }),
          ...(m.refillSoon && { refillSoon: true }),
        })),
        upcomingDosesCount: context.medicines.upcomingDoses.length,
      };
    }

    if (context.metrics) {
      payload.metrics = {
        latestReadings: Object.fromEntries(
          Object.entries(context.metrics.latestReadings).map(([k, v]) => [
            k,
            { value: v.value, unit: v.unit, isAbnormal: v.isAbnormal },
          ])
        ),
        averages: context.metrics.averages,
        abnormalCount: context.metrics.abnormalReadings.length,
        trends: context.metrics.trends,
      };
    }

    if (context.notifications) {
      payload.notifications = {
        unreadCount: context.notifications.unreadCount,
        pendingActions: context.notifications.pendingActions,
      };
    }

    return JSON.stringify(payload, null, 2);
  }
}