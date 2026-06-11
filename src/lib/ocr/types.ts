// src/lib/ocr/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// OCR provider abstraction layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface OCRResult {
  rawText:         string;
  confidence:      number;
  blocks?:         OCRBlock[];
  provider:        OCRProviderName;
  processingTimeMs: number;
}

export interface OCRBlock {
  text:        string;
  confidence:  number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface OCRProvider {
  readonly name: OCRProviderName;
  extractText(
    imageBuffer: Buffer | Uint8Array,
    mimeType:    SupportedMimeType
  ): Promise<OCRResult>;
}

// ─── Provider registry ────────────────────────────────────────────────────────

/**
 * "ocr_space" and "ocrspace" are both accepted (env var may use either casing).
 */
export type OCRProviderName =
  | "mock"
  | "ocr_space"
  | "ocrspace"   // alias — normalised to ocr_space at runtime
  | "tesseract"
  | "google"
  | "aws"
  | "azure";

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

export function isSupportedMimeType(mime: string): mime is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

// ─── Error type ────────────────────────────────────────────────────────────────

export type OCRErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "LOW_QUALITY"
  | "TIMEOUT"
  | "UNKNOWN";

export class OCRError extends Error {
  readonly code:     OCRErrorCode;
  readonly provider: OCRProviderName;

  constructor(message: string, code: OCRErrorCode, provider: OCRProviderName) {
    super(message);
    this.name     = "OCRError";
    this.code     = code;
    this.provider = provider;
  }
}

// ─── Provider config types ────────────────────────────────────────────────────

export interface BaseProviderConfig {
  timeoutMs?:       number;
  maxFileSizeBytes?: number;
}

export interface OcrSpaceConfig extends BaseProviderConfig {
  apiKey:   string;
  engine?:  "1" | "2" | "3";  // Engine 2 = best for printed text
  language?: string;           // ISO 639-1, default "eng"
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
  endpoint:   string;
  apiKey:     string;
  apiVersion?: string;
}

export interface TesseractConfig extends BaseProviderConfig {
  languages?: string[];
  langPath?:  string;
}