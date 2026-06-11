// src/lib/ai/gemini-chat.provider.ts
// ─────────────────────────────────────────────────────────────────────────────
// Google Gemini chat provider for the MediTrack AI assistant.
//
// Uses the Gemini generateContent REST API.
// This is distinct from medicine-analyzer.ts which also uses Gemini but for
// structured OCR extraction — that one is always Gemini regardless of
// AI_PROVIDER because the structured-output prompting is Gemini-specific.
//
// CONFIGURATION (when AI_PROVIDER=gemini)
//   GEMINI_API_KEY           Required
//   GEMINI_MODEL             Optional — default: gemini-2.0-flash
//   GEMINI_MAX_TOKENS        Optional — default: 1024
//   GEMINI_TIMEOUT_MS        Optional — default: 30000
// ─────────────────────────────────────────────────────────────────────────────

import type { AIMessage, AIContext, AIProvider, AIResponse } from "./types";

// ─── Gemini API shapes ────────────────────────────────────────────────────────

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role:  "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequest {
  system_instruction?: { parts: GeminiPart[] };
  contents:            GeminiContent[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?:     number;
  };
}

interface GeminiResponseCandidate {
  content: { parts: GeminiPart[]; role: string };
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiResponseCandidate[];
  error?:      { code: number; message: string; status: string };
}

// ─── Message converter ────────────────────────────────────────────────────────

/**
 * Converts internal AIMessage[] → Gemini's user/model alternating format.
 * System messages are folded into system_instruction (preferred) or prepended
 * to the first user turn.
 */
function toGeminiContents(messages: AIMessage[]): {
  contents:            GeminiContent[];
  systemInstruction?:  string;
} {
  const systemParts: string[] = [];
  const turns: AIMessage[]    = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      turns.push(msg);
    }
  }

  const systemInstruction = systemParts.join("\n\n") || undefined;

  // Map to Gemini roles; merge consecutive same-role turns
  const contents: GeminiContent[] = [];
  for (const msg of turns) {
    const role = msg.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${msg.content}`;
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Must end with a user turn
  if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
    contents.push({ role: "user", parts: [{ text: "Please continue." }] });
  }

  return { contents, systemInstruction };
}

// ─── Provider class ───────────────────────────────────────────────────────────

export class GeminiChatProvider implements AIProvider {
  readonly name:  string;
  readonly model: string;

  private readonly apiKey:    string;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(options: {
    apiKey:     string;
    model?:     string;
    maxTokens?: number;
    timeoutMs?: number;
  }) {
    if (!options.apiKey) {
      throw new Error("[GeminiChatProvider] apiKey is required");
    }
    this.apiKey    = options.apiKey;
    this.model     = options.model     ?? "gemini-2.0-flash";
    this.maxTokens = options.maxTokens ?? 1024;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.name      = "gemini";
  }

  async generateResponse(
    messages:      AIMessage[],
    _context:      AIContext,
    systemPrompt?: string
  ): Promise<AIResponse> {
    // Merge the explicit systemPrompt with any "system" role messages
    const allMessages: AIMessage[] = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : messages;

    const { contents, systemInstruction } = toGeminiContents(allMessages);

    const body: GeminiRequest = {
      contents,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature:     0.7,
      },
    };

    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent` +
      `?key=${this.apiKey}`;

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : "unknown";
      if ((err as { name?: string })?.name === "AbortError") {
        throw new Error(`Gemini API timed out after ${this.timeoutMs}ms`);
      }
      throw new Error(`Gemini API network error: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    let data: GeminiResponse;
    try {
      data = (await response.json()) as GeminiResponse;
    } catch {
      throw new Error(`Gemini API returned non-JSON (HTTP ${response.status})`);
    }

    if (!response.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Gemini API error: ${errMsg}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API response contained no text content");
    }

    return {
      content:  text,
      model:    this.model,
      provider: this.name,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.generateResponse(
        [{ role: "user", content: "ping" }],
        {} as AIContext
      );
      return true;
    } catch {
      return false;
    }
  }
}