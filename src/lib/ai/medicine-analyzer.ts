// src/lib/ai/medicine-analyzer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicine Analyzer — uses Google Gemini to extract structured medicine data
// from raw OCR text.
//
// Input:  raw OCR text from a prescription or medicine package
// Output: structured medicine data with confidence score
//
// Env:  GEMINI_API_KEY  (required)
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicineAnalysisResult {
  medicineName: string | null;
  normalizedMedicineName: string | null;
  genericName: string | null;
  dosage: string | null;
  frequency: string | null;
  frequencyCode: string | null; // maps to FREQUENCY_VALUES enum
  duration: string | null;
  prescribedBy: string | null;
  instructions: string | null;
  warnings: string[];
  category: string | null;
  confidence: number; // 0–1
  ocrCorrectionsMade: boolean;
  rawAnalysis: string; // full LLM response for debugging
}

export interface MedicineAnalyzerOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

// ─── Frequency normalizer ─────────────────────────────────────────────────────

const FREQUENCY_MAP: Record<string, string> = {
  "once daily": "once_daily",
  "once a day": "once_daily",
  "1x daily": "once_daily",
  "qd": "once_daily",
  "every day": "once_daily",
  "twice daily": "twice_daily",
  "twice a day": "twice_daily",
  "2x daily": "twice_daily",
  "bid": "twice_daily",
  "b.i.d": "twice_daily",
  "three times daily": "three_times_daily",
  "three times a day": "three_times_daily",
  "3x daily": "three_times_daily",
  "tid": "three_times_daily",
  "t.i.d": "three_times_daily",
  "four times daily": "four_times_daily",
  "four times a day": "four_times_daily",
  "4x daily": "four_times_daily",
  "qid": "four_times_daily",
  "every other day": "every_other_day",
  "alternate days": "every_other_day",
  "eod": "every_other_day",
  "weekly": "weekly",
  "once a week": "weekly",
  "as needed": "as_needed",
  "prn": "as_needed",
  "when needed": "as_needed",
};

function normalizeFrequency(freq: string | null): string | null {
  if (!freq) return null;
  const lower = freq.toLowerCase().trim();
  for (const [key, val] of Object.entries(FREQUENCY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "once_daily"; // safe default
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(ocrText: string): string {
  return `You are a pharmaceutical data extraction expert. Analyze the following OCR text extracted from a prescription label or medicine package and extract structured medicine information.

OCR TEXT:
"""
${ocrText}
"""

Instructions:
1. Correct any obvious OCR errors (e.g., "0" vs "O", "1" vs "I", garbled words)
2. Normalize the medicine name to its proper pharmaceutical name
3. Extract dosage as a standardized string (e.g., "500 mg", "10 mg", "2000 IU")
4. Extract frequency using these standard terms: "once daily", "twice daily", "three times daily", "four times daily", "every other day", "weekly", "as needed"
5. Extract duration if mentioned (e.g., "7 days", "30 days", "ongoing")
6. Extract prescriber name if present
7. Extract any important instructions or warnings
8. Determine the medicine category (e.g., "Antibiotic", "Antidiabetic", "ACE Inhibitor", "Statin", "NSAID", "Supplement")
9. Set confidence between 0.0 and 1.0 based on how clearly the information was extractable

Return ONLY a valid JSON object with NO markdown, NO code blocks, NO extra text. Just the raw JSON:

{
  "medicineName": "string or null",
  "normalizedMedicineName": "string or null",
  "genericName": "string or null",
  "dosage": "string or null",
  "frequency": "string or null",
  "duration": "string or null",
  "prescribedBy": "string or null",
  "instructions": "string or null",
  "warnings": ["array", "of", "strings"],
  "category": "string or null",
  "confidence": 0.0,
  "ocrCorrectionsMade": true
}`;
}

// ─── Main analyzer class ──────────────────────────────────────────────────────

export class MedicineAnalyzer {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: MedicineAnalyzerOptions = {}) {
    this.apiKey =
      options.apiKey ??
      process.env.GEMINI_API_KEY ??
      "";
    this.model = options.model ?? "gemini-2.0-flash";
    this.timeoutMs = options.timeoutMs ?? 30_000;

    if (!this.apiKey) {
      console.warn("[MedicineAnalyzer] GEMINI_API_KEY not set — analysis will fail");
    }
  }

  async analyze(ocrText: string): Promise<MedicineAnalysisResult> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    if (!ocrText?.trim()) {
      return this._emptyResult("No OCR text provided");
    }

    const prompt = buildPrompt(ocrText);

    // Call Gemini REST API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1, // low temperature for structured extraction
            maxOutputTokens: 1024,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Gemini API request timed out");
      }
      throw new Error(`Gemini API network error: ${err?.message ?? "unknown"}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini API error ${response.status}: ${body}`);
    }

    let geminiData: any;
    try {
      geminiData = await response.json();
    } catch {
      throw new Error("Gemini API returned invalid JSON");
    }

    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      return this._emptyResult("Gemini returned empty response");
    }

    // Parse the JSON out of the response
    let parsed: any;
    try {
      // Strip markdown code blocks if present (defensive)
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, try to extract JSON object from text
      const jsonMatch = rawText.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return this._emptyResult("Could not parse Gemini response as JSON");
        }
      } else {
        return this._emptyResult("Gemini response contained no JSON");
      }
    }

    return {
      medicineName: parsed.medicineName ?? null,
      normalizedMedicineName: parsed.normalizedMedicineName ?? parsed.medicineName ?? null,
      genericName: parsed.genericName ?? null,
      dosage: parsed.dosage ?? null,
      frequency: parsed.frequency ?? null,
      frequencyCode: normalizeFrequency(parsed.frequency),
      duration: parsed.duration ?? null,
      prescribedBy: parsed.prescribedBy ?? null,
      instructions: parsed.instructions ?? null,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      category: parsed.category ?? null,
      confidence: typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5,
      ocrCorrectionsMade: parsed.ocrCorrectionsMade === true,
      rawAnalysis: rawText,
    };
  }

  private _emptyResult(reason: string): MedicineAnalysisResult {
    console.warn("[MedicineAnalyzer] Empty result:", reason);
    return {
      medicineName: null,
      normalizedMedicineName: null,
      genericName: null,
      dosage: null,
      frequency: null,
      frequencyCode: null,
      duration: null,
      prescribedBy: null,
      instructions: null,
      warnings: [],
      category: null,
      confidence: 0,
      ocrCorrectionsMade: false,
      rawAnalysis: reason,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _analyzerInstance: MedicineAnalyzer | null = null;

export function getMedicineAnalyzer(): MedicineAnalyzer {
  if (!_analyzerInstance) {
    _analyzerInstance = new MedicineAnalyzer();
  }
  return _analyzerInstance;
}