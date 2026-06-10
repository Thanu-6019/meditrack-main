// src/lib/ocr/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// OCR provider abstraction layer.
//
// DESIGN INTENT
// ─────────────────────────────────────────────────────────────────────────────
// All OCR providers implement the same `OCRProvider` interface.
// The factory in `index.ts` returns the correct provider based on the
// `OCR_PROVIDER` environment variable.
//
// Adding a new provider:
//   1. Create `src/lib/ocr/<name>.provider.ts` implementing `OCRProvider`.
//   2. Add a case to `getOCRProvider()` in `src/lib/ocr/index.ts`.
//   3. Set OCR_PROVIDER=<name> in the environment.
//   Zero changes needed to route handlers or the scanner pipeline.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Core types ───────────────────────────────────────────────────────────────

/**
 * The raw result returned by any OCR provider after processing an image.
 * All providers normalise their vendor-specific response into this shape.
 */
export interface OCRResult {
  /** Full extracted text as a single string. Lines are separated by `\n`. */
  rawText: string;

  /**
   * Overall confidence score for the extraction.
   * 0 = no confidence / unusable, 1 = perfect.
   * Providers that don't expose a native confidence score should return a
   * conservative estimate (e.g. 0.7 for a successful extraction).
   */
  confidence: number;

  /**
   * Individual text blocks, if the provider returns segmented results.
   * Optional — the scanner pipeline works with `rawText` alone.
   */
  blocks?: OCRBlock[];

  /** Which provider produced this result (for debugging / logging). */
  provider: OCRProviderName;

  /** Wall-clock milliseconds spent in the OCR call (for monitoring). */
  processingTimeMs: number;
}

/**
 * A single detected text region/block with its own confidence score.
 * Useful for future features like bounding-box rendering or sorting.
 */
export interface OCRBlock {
  text:        string;
  confidence:  number;  // 0–1
  boundingBox?: BoundingBox;
}

/**
 * Pixel bounding box for a detected block.
 * Expressed as offsets from the top-left corner of the original image.
 */
export interface BoundingBox {
  x:      number; // left offset
  y:      number; // top offset
  width:  number;
  height: number;
}

// ─── Provider interface ────────────────────────────────────────────────────────

/**
 * Every OCR provider must implement this interface.
 *
 * The only requirement is that it accepts a `Buffer` (or `Uint8Array`)
 * containing raw image bytes and returns a normalised `OCRResult`.
 *
 * The implementation may be async (calling an external API) or synchronous
 * (running a local model like Tesseract).
 */
export interface OCRProvider {
  /** Unique name for this provider — used in logs and `OCRResult.provider`. */
  readonly name: OCRProviderName;

  /**
   * Extract text from the given image buffer.
   *
   * @param imageBuffer - Raw bytes of a supported image (JPEG, PNG, WEBP, PDF).
   * @param mimeType    - MIME type of the image, e.g. "image/jpeg".
   *                      Providers that care (e.g. Google Vision) use this to
   *                      set the correct request content type.
   * @returns A normalised `OCRResult`.
   * @throws  `OCRError` on provider-level failure.
   */
  extractText(
    imageBuffer: Buffer | Uint8Array,
    mimeType:    SupportedMimeType
  ): Promise<OCRResult>;
}

// ─── Provider registry ────────────────────────────────────────────────────────

/**
 * All known OCR provider names.
 * Add new names here when implementing new providers.
 */
export type OCRProviderName =
  | "mock"       // Development / testing — no external calls
  | "tesseract"  // Local Tesseract.js — no API cost, lower accuracy
  | "google"     // Google Cloud Vision API
  | "aws"        // AWS Textract
  | "azure";     // Azure AI Vision (formerly Computer Vision)

// ─── MIME types ───────────────────────────────────────────────────────────────

export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * Returns true if the given MIME type is accepted by the scanner pipeline.
 * Used by the route handler for early validation before calling the OCR provider.
 */
export function isSupportedMimeType(mime: string): mime is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

// ─── Error type ────────────────────────────────────────────────────────────────

export type OCRErrorCode =
  | "PROVIDER_UNAVAILABLE"   // External API unreachable / auth failed
  | "IMAGE_TOO_LARGE"        // File exceeds provider limits
  | "UNSUPPORTED_FORMAT"     // Provider can't process this image type
  | "LOW_QUALITY"            // Image quality too poor for any extraction
  | "TIMEOUT"                // Provider timed out
  | "UNKNOWN";               // Catch-all

/**
 * Structured error thrown by OCR providers.
 * Route handlers catch this and map it to an appropriate HTTP response.
 */
export class OCRError extends Error {
  readonly code:     OCRErrorCode;
  readonly provider: OCRProviderName;

  constructor(
    message:  string,
    code:     OCRErrorCode,
    provider: OCRProviderName
  ) {
    super(message);
    this.name     = "OCRError";
    this.code     = code;
    this.provider = provider;
  }
}

// ─── Provider configuration types (for future providers) ─────────────────────

/**
 * Base configuration shared by all providers.
 * Extended by provider-specific config interfaces below.
 */
export interface BaseProviderConfig {
  /** Request timeout in milliseconds. Default: 30_000 (30s). */
  timeoutMs?: number;
  /** Maximum image size in bytes the provider will accept. */
  maxFileSizeBytes?: number;
}

export interface GoogleVisionConfig extends BaseProviderConfig {
  apiKey:     string;
  projectId?: string;
}

export interface AWSTextractConfig extends BaseProviderConfig {
  region:          string;
  accessKeyId:     string;
  secretAccessKey: string;
}

export interface AzureVisionConfig extends BaseProviderConfig {
  endpoint:  string;
  apiKey:    string;
  apiVersion?: string;
}

export interface TesseractConfig extends BaseProviderConfig {
  /** Language codes. Default: ["eng"]. */
  languages?: string[];
  /** Path to trained data directory. Uses bundled data if not provided. */
  langPath?: string;
}