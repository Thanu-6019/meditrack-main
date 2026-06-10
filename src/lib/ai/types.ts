// ─── Core Message Types ────────────────────────────────────────────────────────

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

// ─── Context Types ─────────────────────────────────────────────────────────────

export interface MedicineContext {
  activeCount: number;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    remainingPills?: number;
    refillSoon?: boolean;
  }>;
  adherence: {
    overallPercentage: number;
    missedDosesThisWeek: number;
    missedDosesThisMonth: number;
    streakDays: number;
  };
  upcomingDoses: Array<{
    medicineName: string;
    scheduledAt: Date;
  }>;
}

export interface HealthMetricContext {
  latestReadings: Record<
    string,
    {
      value: number;
      unit: string;
      recordedAt: Date;
      isAbnormal: boolean;
    }
  >;
  averages: Record<
    string,
    {
      value: number;
      unit: string;
      periodDays: number;
    }
  >;
  abnormalReadings: Array<{
    type: string;
    value: number;
    unit: string;
    recordedAt: Date;
    severity: "mild" | "moderate" | "severe";
  }>;
  trends: Record<
    string,
    {
      direction: "improving" | "worsening" | "stable";
      changePercent: number;
    }
  >;
}

export interface NotificationContext {
  unreadCount: number;
  recentAlerts: Array<{
    type: string;
    message: string;
    createdAt: Date;
    priority: "low" | "medium" | "high";
  }>;
  pendingActions: string[];
}

export interface UserContext {
  userId: string;
  timezone?: string;
  preferredName?: string;
}

export interface AIContext {
  user: UserContext;
  medicines: MedicineContext | null;
  metrics: HealthMetricContext | null;
  notifications: NotificationContext | null;
  generatedAt: Date;
  conversationHistory: AIMessage[];
}

// ─── Insight Types ─────────────────────────────────────────────────────────────

export type InsightCategory =
  | "adherence"
  | "metrics"
  | "refill"
  | "trend"
  | "general";

export type InsightSeverity = "info" | "warning" | "critical";

export interface HealthInsight {
  category: InsightCategory;
  severity: InsightSeverity;
  message: string;
  recommendation?: string;
  data?: Record<string, unknown>;
}

// ─── Guardrail Types ───────────────────────────────────────────────────────────

export type GuardrailType = "diagnosis" | "emergency" | "prescription" | "safe";

export interface GuardrailResult {
  isSafe: boolean;
  type: GuardrailType;
  response?: string; // Pre-built safe response if triggered
}

// ─── Provider Interface ────────────────────────────────────────────────────────

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  generateResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string
  ): Promise<AIResponse>;

  isHealthy(): Promise<boolean>;
}

// ─── API Request / Response Shapes ────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  conversationId?: string; // Optional: continue existing conversation
}

export interface ChatResponse {
  conversationId: string;
  message: AIMessage;
  insights?: HealthInsight[];
  guardrailTriggered?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: Date;
  lastMessageAt: Date;
}