import { NextRequest, NextResponse } from "next/server";
// @ts-ignore
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import AIConversation from "@/models/AIConversation";
import { getAIProvider } from "@/lib/ai";
import { ContextBuilder } from "@/lib/ai/context-builder";
import { InsightEngine } from "@/lib/ai/insight-engine";
import { checkGuardrails, sanitizeInput } from "@/lib/ai/Guardrails";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import type { AIMessage, ChatRequest, ChatResponse } from "@/lib/ai/types";

// ─── Service Layer Imports ─────────────────────────────────────────────────────
// Replace these with your actual service implementations.
// The AI layer never touches MongoDB directly.
import { medicineService } from "@/services/medicine.service";
import { healthMetricService } from "@/services/health-metric.service";
import { notificationService } from "@/services/notification.service";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getUserId(session: { user?: { id?: string } } | null): string | null {
  return session?.user?.id ?? null;
}

async function getOrCreateConversation(
  userId: string,
  conversationId?: string
) {
  if (conversationId) {
    const existing = await AIConversation.findOne({
      _id: new (mongoose.Types.ObjectId as any)(conversationId),
      userId: new (mongoose.Types.ObjectId as any)(userId),
    });
    if (!existing) return null; // Not found or not owned by user
    return existing;
  }

  // Start a fresh conversation
  const conv = new AIConversation({
    userId: new (mongoose.Types.ObjectId as any)(userId),
    title: "New Conversation",
    messages: [],
  });
  return conv;
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const session = await getServerSession();
    const userId = getUserId(session as any);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    // ── 2. Parse & validate body ─────────────────────────────────────────────
    let body: ChatRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { message, conversationId } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "message is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "message must be 2000 characters or fewer." },
        { status: 400 }
      );
    }

    // Sanitize before any further processing or storage
    const sanitizedMessage = sanitizeInput(message);

    // ── 3. Guardrails ────────────────────────────────────────────────────────
    const guardrailResult = checkGuardrails(sanitizedMessage);

    if (!guardrailResult.isSafe) {
      // Persist the exchange even for guardrailed responses so the user
      // has a record, but mark it in metadata.
      const conv = await getOrCreateConversation(userId, conversationId);
      if (conv) {
        const userMsg: AIMessage = {
          role: "user",
          content: sanitizedMessage,
          timestamp: new Date(),
        };
        const assistantMsg: AIMessage = {
          role: "assistant",
          content: guardrailResult.response!,
          timestamp: new Date(),
        };
        conv.messages.push(
          { ...userMsg, metadata: { guardrailTriggered: true, guardrailType: guardrailResult.type } } as any,
          assistantMsg as any
        );
        await conv.save();

        const response: ChatResponse = {
          conversationId: conv.id,
          message: assistantMsg,
          guardrailTriggered: true,
        };
        return NextResponse.json(response, { status: 200 });
      }
    }

    // ── 4. Load / create conversation ────────────────────────────────────────
    const conversation = await getOrCreateConversation(userId, conversationId);
    if (conversationId && !conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Failed to initialize conversation." },
        { status: 500 }
      );
    }

    // ── 5. Build context from service layer ──────────────────────────────────
// ── 5. Build context from service layer ──────────────────────────────────
// ── 5. Build context from service layer ──────────────────────────────────
    const contextBuilder = new ContextBuilder(
      medicineService as any,
      healthMetricService as any,
      notificationService as any
    );

    // Include last 10 messages as conversation history for the LLM
    const recentHistory: AIMessage[] = conversation.messages
      .slice(-10)
      .map((m: any) => ({ role: m.role, content: m.content }));

    const context = await contextBuilder.build(userId, recentHistory);

    // ── 6. Generate insights ─────────────────────────────────────────────────
    const insightEngine = new InsightEngine();
    const insights = insightEngine.generate(context);
    const insightSummary = insightEngine.formatForPrompt(insights);

    // Inject insights into the context for the system prompt
    const enrichedMessages: AIMessage[] = [
      ...recentHistory,
      {
        role: "system",
        content: `CURRENT HEALTH INSIGHTS:\n${insightSummary}`,
      },
      {
        role: "user",
        content: sanitizedMessage,
      },
    ];

    // ── 7. Generate AI response ──────────────────────────────────────────────
    const aiProvider = getAIProvider();
    const systemPrompt = buildSystemPrompt(context);

    const aiResponse = await aiProvider.generateResponse(
      enrichedMessages,
      context,
      systemPrompt
    );

    // ── 8. Persist conversation ──────────────────────────────────────────────
    const userMsg = {
      role: "user" as const,
      content: sanitizedMessage,
      timestamp: new Date(),
    };
    const assistantMsg = {
      role: "assistant" as const,
      content: aiResponse.content,
      timestamp: new Date(),
      metadata: { insightsIncluded: insights.length > 0 },
    };

    conversation.messages.push(userMsg as any, assistantMsg as any);
    await conversation.save();

    // ── 9. Return response ───────────────────────────────────────────────────
    const response: ChatResponse = {
      conversationId: conversation.id,
      message: assistantMsg,
      insights: insights.slice(0, 5), // Surface top 5 insights to client
      guardrailTriggered: false,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[AI Chat] Unhandled error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}