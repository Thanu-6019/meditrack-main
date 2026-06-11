// src/lib/ai/medicine-analyzer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicine Analyzer — uses Google Gemini to extract structured medicine data
// from raw OCR text.
//
// This module is always Gemini-based regardless of AI_PROVIDER because the
// structured JSON extraction prompt is tuned specifically for Gemini's output
// format. The chat assistant (AI_PROVIDER) is a separate concern.
//
// CONFIGURATION
//   GEMINI_API_KEY           Required
//   GEMINI_ANALYZER_MODEL    Optional — default: gemini-2.0-flash
//   GEMINI_ANALYZER_TIMEOUT  Optional — default: 30000 (ms)
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicineAnalysisResult {
  medicineName:            string | null;
  normalizedMedicineName:  string | null;
  genericName:             string | null;
  dosage:                  string | null;
  frequency:               string | null;
  frequencyCode:           string | null;
  duration:                string | null;
  prescribedBy:            string | null;
  instructions:            string | null;
  warnings:                string[];
  category:                string | null;
  confidence:              number;
  ocrCorrectionsMade:      boolean;
  rawAnalysis:             string;
}

export interface MedicineAnalyzerOptions {
  apiKey?:    string;
  model?:     string;
  timeoutMs?: number;
}

// ─── Frequency normaliser ─────────────────────────────────────────────────────

const FREQUENCY_MAP: Record<string, string> = {
  "once daily":           "once_daily",
  "once a day":           "once_daily",
  "1x daily":             "once_daily",
  "qd":                   "once_daily",
  "every day":            "once_daily",
  "twice daily":          "twice_daily",
  "twice a day":          "twice_daily",
  "2x daily":             "twice_daily",
  "bid":                  "twice_daily",
  "b.i.d":                "twice_daily",
  "three times daily":    "three_times_daily",
  "three times a day":    "three_times_daily",
  "3x daily":             "three_times_daily",
  "tid":                  "three_times_daily",
  "t.i.d":                "three_times_daily",
  "four times daily":     "four_times_daily",
  "four times a day":     "four_times_daily",
  "4x daily":             "four_times_daily",
  "qid":                  "four_times_daily",
  "every other day":      "every_other_day",
  "alternate days":       "every_other_day",
  "eod":                  "every_other_day",
  "weekly":               "weekly",
  "once a week":          "weekly",
  "as needed":            "as_needed",
  "prn":                  "as_needed",
  "when needed":          "as_needed",
};

function normalizeFrequency(freq: string | null): string | null {
  if (!freq) return null;
  const lower = freq.toLowerCase().trim();
  for (const [key, val] of Object.entries(FREQUENCY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "once_daily";
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

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

Return ONLY a valid JSON object with NO markdown, NO code blocks, NO extra text:

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

// ─── JSON extraction helper ───────────────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> | null {
  // 1. Try direct parse (Gemini should return clean JSON per the prompt)
  try {
    const clean = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    return JSON.parse(clean) as Record<string, unknown>;
  } catch { /* fall through */ }

  // 2. Regex extraction as fallback
  const match = text.match(/\{[\s\S]+\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch { /* fall through */ }
  }

  return null;
}

// ─── Main analyzer class ──────────────────────────────────────────────────────

export class MedicineAnalyzer {
  private readonly apiKey:    string;
  private readonly model:     string;
  private readonly timeoutMs: number;

  constructor(options: MedicineAnalyzerOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    if (!apiKey) {
      throw new Error(
        "[MedicineAnalyzer] GEMINI_API_KEY is not set. " +
        "The prescription scanner requires a valid Gemini API key."
      );
    }
    this.apiKey    = apiKey;
    this.model     = options.model     ?? process.env.GEMINI_ANALYZER_MODEL ?? "gemini-2.0-flash";
    this.timeoutMs = options.timeoutMs ?? parseInt(process.env.GEMINI_ANALYZER_TIMEOUT ?? "30000", 10);
  }

  async analyze(ocrText: string): Promise<MedicineAnalysisResult> {
    if (!ocrText?.trim()) {
      return this._emptyResult("No OCR text provided");
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}` +
      `:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(ocrText) }] }],
          generationConfig: {
            temperature:     0.1,
            maxOutputTokens: 1024,
          },
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : "unknown";
      if ((err as { name?: string })?.name === "AbortError") {
        throw new Error(`Gemini analyzer timed out after ${this.timeoutMs}ms`);
      }
      throw new Error(`Gemini analyzer network error: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini analyzer HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    let geminiData: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?:      { message?: string };
    };
    try {
      geminiData = await response.json();
    } catch {
      throw new Error("Gemini analyzer returned non-JSON response");
    }

    if (geminiData.error?.message) {
      throw new Error(`Gemini analyzer error: ${geminiData.error.message}`);
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) {
      return this._emptyResult("Gemini returned empty response");
    }

    const parsed = extractJSON(rawText);
    if (!parsed) {
      return this._emptyResult("Could not parse Gemini response as JSON");
    }

    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5;

    return {
      medicineName:           (parsed.medicineName           as string | null) ?? null,
      normalizedMedicineName: (parsed.normalizedMedicineName as string | null) ?? (parsed.medicineName as string | null) ?? null,
      genericName:            (parsed.genericName            as string | null) ?? null,
      dosage:                 (parsed.dosage                 as string | null) ?? null,
      frequency:              (parsed.frequency              as string | null) ?? null,
      frequencyCode:          normalizeFrequency((parsed.frequency as string | null) ?? null),
      duration:               (parsed.duration               as string | null) ?? null,
      prescribedBy:           (parsed.prescribedBy           as string | null) ?? null,
      instructions:           (parsed.instructions           as string | null) ?? null,
      warnings:               Array.isArray(parsed.warnings) ? (parsed.warnings as string[]) : [],
      category:               (parsed.category               as string | null) ?? null,
      confidence,
      ocrCorrectionsMade:     parsed.ocrCorrectionsMade === true,
      rawAnalysis:            rawText,
    };
  }

  private _emptyResult(reason: string): MedicineAnalysisResult {
    console.warn("[MedicineAnalyzer] Empty result:", reason);
    return {
      medicineName:            null,
      normalizedMedicineName:  null,
      genericName:             null,
      dosage:                  null,
      frequency:               null,
      frequencyCode:           null,
      duration:                null,
      prescribedBy:            null,
      instructions:            null,
      warnings:                [],
      category:                null,
      confidence:              0,
      ocrCorrectionsMade:      false,
      rawAnalysis:             reason,
    };
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _analyzerInstance: MedicineAnalyzer | null = null;

export function getMedicineAnalyzer(): MedicineAnalyzer {
  if (!_analyzerInstance) {
    _analyzerInstance = new MedicineAnalyzer();
  }
  return _analyzerInstance;
}

/** Reset the singleton — useful in tests. */
export function resetMedicineAnalyzer(): void {
  _analyzerInstance = null;
}