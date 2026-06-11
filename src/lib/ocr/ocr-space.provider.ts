// src/lib/ocr/ocr-space.provider.ts
// ─────────────────────────────────────────────────────────────────────────────
// OCR.space provider — free-tier OCR API, no billing required.
// Docs: https://ocr.space/ocrapi
// Set OCR_PROVIDER=ocr_space and OCR_SPACE_API_KEY in .env.local
// Free key (limited): use "helloworld" as key for testing
// ─────────────────────────────────────────────────────────────────────────────

import {
  type OCRProvider,
  type OCRResult,
  type SupportedMimeType,
  OCRError,
} from "./types";

export class OcrSpaceProvider implements OCRProvider {
  readonly name = "ocr_space" as any;

  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: { apiKey: string; timeoutMs?: number }) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async extractText(
    imageBuffer: Buffer | Uint8Array,
    mimeType: SupportedMimeType
  ): Promise<OCRResult> {
    const start = Date.now();

    // Build multipart form
    const formData = new FormData();
    formData.append("apikey", this.apiKey);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // Engine 2 is better for printed text

    // Convert buffer to Blob
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
    const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
    formData.append("file", blob, `scan.${ext}`);

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new OCRError("OCR.space request timed out", "TIMEOUT", "ocr_space" as any);
      }
      throw new OCRError(
        `OCR.space network error: ${err?.message ?? "unknown"}`,
        "PROVIDER_UNAVAILABLE",
        "ocr_space" as any
      );
    }

    if (!response.ok) {
      throw new OCRError(
        `OCR.space HTTP ${response.status}`,
        "PROVIDER_UNAVAILABLE",
        "ocr_space" as any
      );
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new OCRError("OCR.space returned invalid JSON", "PROVIDER_UNAVAILABLE", "ocr_space" as any);
    }

    if (json.IsErroredOnProcessing) {
      throw new OCRError(
        json.ErrorMessage?.[0] ?? "OCR.space processing error",
        "PROVIDER_UNAVAILABLE",
        "ocr_space" as any
      );
    }

    const parsedResults: any[] = json.ParsedResults ?? [];
    if (!parsedResults.length) {
      throw new OCRError("OCR.space returned no results", "LOW_QUALITY", "ocr_space" as any);
    }

    // Combine text from all pages
    const rawText = parsedResults
      .map((r: any) => r.ParsedText ?? "")
      .join("\n")
      .trim();

    // OCR.space doesn't return per-word confidence, use exit code as proxy
    // ExitCode 1 = success, 2 = warning, 3-6 = errors
    const exitCode: number = parsedResults[0]?.FileParseExitCode ?? 1;
    const confidence = exitCode === 1 ? 0.92 : exitCode === 2 ? 0.70 : 0.50;

    const processingTimeMs = Date.now() - start;

    return {
      rawText,
      confidence,
      provider: "ocr_space" as any,
      processingTimeMs,
      blocks: parsedResults.map((r: any) => ({
        text: r.ParsedText ?? "",
        confidence,
      })),
    };
  }
}