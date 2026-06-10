// src/lib/ocr/mock.provider.ts
// ─────────────────────────────────────────────────────────────────────────────
// MockOCRProvider — development-only OCR implementation.
//
// PURPOSE
// ─────────────────────────────────────────────────────────────────────────────
// Provides deterministic, zero-latency OCR output without any external calls.
// Used when OCR_PROVIDER=mock (the default in development).
//
// BEHAVIOUR
// ─────────────────────────────────────────────────────────────────────────────
// • Returns one of several realistic prescription label samples.
// • Which sample is selected is based on a hash of the image buffer so the
//   same image always produces the same result (useful for testing).
// • Supports an optional artificial delay to simulate real provider latency.
// • Never throws OCRError — if you need to test error paths, use the
//   `MockOCRProvider.setNextError()` method in tests.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type OCRProvider,
  type OCRResult,
  type SupportedMimeType,
  type OCRBlock,
  OCRError,
} from "./types";

// ─── Sample prescription texts ────────────────────────────────────────────────

/**
 * Realistic-looking prescription label samples.
 * Each entry is what a real OCR provider might return from a pharmacy label
 * or blister pack.
 */
const MOCK_SAMPLES: ReadonlyArray<{
  rawText:    string;
  confidence: number;
}> = [
  // ── Sample 0: Standard tablet prescription ─────────────────────────────────
  {
    rawText: [
      "BOSTON MEDICAL GROUP PHARMACY",
      "Rx# 8841204  Date: 06/10/2024",
      "",
      "METFORMIN HCl 500MG TABLETS",
      "Qty: 60 tablets  Refills: 3 remaining",
      "",
      "SIG: Take 1 tablet TWICE DAILY with meals",
      "     in the morning and evening",
      "",
      "Prescriber: Dr. Sarah Chen  NPI 1234567890",
      "Patient: Alex Johnson  DOB: 04/12/1988",
      "",
      "WARNING: Avoid alcohol. Take with food.",
      "STORE BELOW 25°C. KEEP OUT OF REACH OF CHILDREN.",
      "",
      "Mfr: Sun Pharmaceutical  Exp: 12/2025",
    ].join("\n"),
    confidence: 0.97,
  },

  // ── Sample 1: Multi-drug blister pack ──────────────────────────────────────
  {
    rawText: [
      "CVS PHARMACY  #4421",
      "123 Main Street, Boston MA 02101",
      "Tel: (617) 555-0100",
      "",
      "LISINOPRIL 10MG",
      "Take 1 tablet once daily for blood pressure",
      "Qty: 30  Exp: 08/2025",
      "",
      "ATORVASTATIN CALCIUM 20MG TABLET",
      "Take 1 tablet at bedtime for cholesterol",
      "Qty: 30  Exp: 03/2026",
      "",
      "VITAMIN D3 2000IU SOFTGEL",
      "Take 1 softgel daily with a fatty meal",
      "Qty: 90  Exp: 01/2026",
      "",
      "Prescriber: Dr. Michael Torres",
      "Refill by: 07/01/2024",
    ].join("\n"),
    confidence: 0.93,
  },

  // ── Sample 2: Single over-the-counter packaging ────────────────────────────
  {
    rawText: [
      "PARACETAMOL 650MG TABLETS",
      "Pack of 15 Film-coated Tablets",
      "",
      "Each tablet contains:",
      "Paracetamol IP  650 mg",
      "",
      "DOSAGE: Adults — 1–2 tablets every 4–6 hours",
      "Do not exceed 4g in 24 hours",
      "",
      "Ibuprofen 400MG",
      "NSAID anti-inflammatory",
      "Take with food or milk",
      "",
      "Amoxicillin 500mg Capsules",
      "Take 1 capsule three times daily",
      "Complete the full course",
      "",
      "Mfd by: Cipla Ltd  Batch: B24089",
      "Exp Date: SEP 2026",
    ].join("\n"),
    confidence: 0.89,
  },

  // ── Sample 3: Controlled substance label ───────────────────────────────────
  {
    rawText: [
      "WALGREENS PHARMACY",
      "Rx: 9920183  CONTROLLED SUBSTANCE",
      "",
      "OMEPRAZOLE 20MG DELAYED-RELEASE CAPSULES",
      "Take 1 capsule by mouth ONCE DAILY",
      "30 min before eating",
      "",
      "METOPROLOL SUCCINATE 50MG ER TABLET",
      "Take 1 tablet once daily with or without food",
      "",
      "AMLODIPINE BESYLATE 5MG",
      "Take 1 tablet every day at the same time",
      "",
      "Patient: Alex Johnson",
      "Dr: Dr. Sarah Chen  DEA: BC1234563",
      "Date filled: 06/01/2024",
    ].join("\n"),
    confidence: 0.95,
  },

  // ── Sample 4: Low-quality / partial scan ───────────────────────────────────
  {
    rawText: [
      "METF0RMIN 5@0MG",   // intentional OCR-like noise
      "T4ke 2x d4ily",
      "",
      "Aspirin 81mg",
      "daily low-dose",
      "",
      "ROSUVASTATIN 10mg",
      "once at bedtime",
    ].join("\n"),
    confidence: 0.52,
  },
];

// ─── MockOCRProvider class ─────────────────────────────────────────────────────

export class MockOCRProvider implements OCRProvider {
  readonly name = "mock" as const;

  /**
   * Optional artificial delay to simulate network latency.
   * Set via constructor or directly before calling extractText.
   * Default: 0ms.
   */
  simulatedDelayMs: number;

  /** If set, the next call to extractText() will throw this error. */
  private _nextError: OCRError | null = null;

  constructor(options: { simulatedDelayMs?: number } = {}) {
    this.simulatedDelayMs = options.simulatedDelayMs ?? 0;
  }

  // ── Test helpers ────────────────────────────────────────────────────────────

  /**
   * Force the next extractText() call to throw the given OCRError.
   * Use in unit tests to exercise error-handling paths.
   *
   * ```ts
   * provider.setNextError(new OCRError("API down", "PROVIDER_UNAVAILABLE", "mock"));
   * ```
   */
  setNextError(err: OCRError): void {
    this._nextError = err;
  }

  // ── Core method ─────────────────────────────────────────────────────────────

  async extractText(
    imageBuffer: Buffer | Uint8Array,
    _mimeType:   SupportedMimeType
  ): Promise<OCRResult> {
    const start = Date.now();

    // Honour any injected test error
    if (this._nextError) {
      const err = this._nextError;
      this._nextError = null;
      throw err;
    }

    // Artificial delay
    if (this.simulatedDelayMs > 0) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, this.simulatedDelayMs)
      );
    }

    // Deterministically pick a sample from the buffer content
    const sampleIdx = this._pickSample(imageBuffer);
    const sample    = MOCK_SAMPLES[sampleIdx];

    const processingTimeMs = Date.now() - start;

    // Build OCRBlock list from the raw text lines
    const blocks = this._buildBlocks(sample.rawText, sample.confidence);

    return {
      rawText:          sample.rawText,
      confidence:       sample.confidence,
      blocks,
      provider:         this.name,
      processingTimeMs,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Hashes the first 64 bytes of the buffer to pick a sample.
   * Same buffer → same sample, making tests predictable.
   */
  private _pickSample(buf: Buffer | Uint8Array): number {
    let hash = 0;
    const end = Math.min(buf.length, 64);
    for (let i = 0; i < end; i++) {
      hash = (hash * 31 + buf[i]) >>> 0; // unsigned 32-bit int
    }
    return hash % MOCK_SAMPLES.length;
  }

  /**
   * Converts raw text lines into `OCRBlock` objects.
   * Each non-empty line becomes its own block with the global confidence
   * slightly jittered to simulate per-block variation.
   */
  private _buildBlocks(rawText: string, baseConfidence: number): OCRBlock[] {
    return rawText
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => ({
        text:       line.trim(),
        // ±5% jitter per block
        confidence: Math.min(
          1,
          Math.max(0, baseConfidence + (((idx * 7) % 10) - 5) / 100)
        ),
      }));
  }
}

// ─── Convenience export ───────────────────────────────────────────────────────

/**
 * Pre-built singleton for use outside of tests.
 * The factory (`getOCRProvider()`) returns this instance when OCR_PROVIDER=mock.
 */
export const mockOCRProvider = new MockOCRProvider({
  simulatedDelayMs: parseInt(process.env.MOCK_OCR_DELAY_MS ?? "0", 10),
});