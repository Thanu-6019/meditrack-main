// src/app/api/scanner/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scanner
//
// Accepts a multipart image upload, runs it through the OCR → parse → validate
// pipeline, and returns structured medicine suggestions.
//
// REQUEST
// ─────────────────────────────────────────────────────────────────────────────
// Content-Type: multipart/form-data
// Field name:   "image"
// File types:   JPEG, PNG, WEBP, HEIC, PDF
// Max size:     10 MB
//
// RESPONSE (success)
// ─────────────────────────────────────────────────────────────────────────────
// {
//   "success": true,
//   "data": {
//     "scanId": "scan_abc123",
//     "rawText": "...",
//     "sanitisedText": "...",
//     "ocrConfidence": 0.97,
//     "ocrProvider": "mock",
//     "processingTimeMs": 142,
//     "medicines": [
//       {
//         "name": "Metformin",
//         "dosage": "500 mg",
//         "frequency": "twice daily",
//         "route": "oral",
//         "prescriber": "Dr. Sarah Chen",
//         "refillDate": "07/01/2024",
//         "exists": true,
//         "canonicalName": "Metformin",
//         "genericName": "Metformin Hydrochloride",
//         "category": "Antidiabetic",
//         "confidence": 1.0,
//         "sideEffects": ["Nausea", "Stomach upset", "Diarrhea"],
//         "foodInteractions": ["Alcohol"],
//         "warnings": ["Avoid in severe renal impairment"],
//         "requiresPrescription": true
//       }
//     ],
//     "interactions": [
//       {
//         "drugA": "Aspirin",
//         "drugB": "Ibuprofen",
//         "severity": "moderate",
//         "description": "..."
//       }
//     ]
//   }
// }
//
// SECURITY RULES
// ─────────────────────────────────────────────────────────────────────────────
// • Requires a valid JWT (enforced by middleware before this runs).
// • Max file size: 10 MB.
// • Accepted MIME types: image/jpeg, image/png, image/webp, image/heic, application/pdf.
// • MIME type is validated both from the Content-Type header AND by inspecting
//   the first 12 bytes of the buffer (magic bytes) to prevent spoofing.
// • OCR text is sanitised before parsing.
// • userId is read from JWT headers — never from the body.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getIdentityFromRequest } from "@/lib/auth-context";
import {
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/auth";
import { getOCRProvider, isSupportedMimeType, OCRError, type SupportedMimeType } from "@/lib/ocr";
import { parseMedicinesFromText } from "@/lib/medicine-parser";
import { validateMedicines } from "@/lib/medicine-validator";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Magic byte signatures for image format detection.
 * We check these AFTER extracting the file buffer so that a malicious actor
 * cannot bypass validation by lying in the Content-Type header.
 */
const MAGIC_BYTES: ReadonlyArray<{
  mime:  SupportedMimeType;
  bytes: Uint8Array;
}> = [
  { mime: "image/jpeg",    bytes: new Uint8Array([0xff, 0xd8, 0xff]) },
  { mime: "image/png",     bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  { mime: "image/webp",    bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]) }, // "RIFF"
  { mime: "application/pdf", bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }, // "%PDF"
  // HEIC files start with ftyp box — first 4 bytes are size, then "ftyp"
  // We check bytes 4–7 instead:
  { mime: "image/heic",    bytes: new Uint8Array([0x66, 0x74, 0x79, 0x70]) }, // "ftyp"
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a short, non-colliding scan ID for tracing.
 * Format: scan_<timestamp_base36><random_base36>
 */
function generateScanId(): string {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `scan_${ts}${rnd}`;
}

/**
 * Detects the actual MIME type by inspecting magic bytes in the buffer.
 * Returns null if the buffer doesn't match any known signature.
 */
function detectMimeFromBuffer(buf: Uint8Array): SupportedMimeType | null {
  for (const { mime, bytes } of MAGIC_BYTES) {
    const offset = mime === "image/heic" ? 4 : 0;
    const slice  = buf.slice(offset, offset + bytes.length);
    if (slice.length === bytes.length && slice.every((b, i) => b === bytes[i])) {
      return mime;
    }
  }
  return null;
}

/**
 * Extracts the image file from the multipart FormData.
 * Returns an error string if validation fails, or the file and buffer on success.
 */
async function extractAndValidateFile(
  request: NextRequest
): Promise<
  | { ok: false; error: string; code: string }
  | { ok: true; file: File; buffer: Buffer; detectedMime: SupportedMimeType }
> {
  // 1. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { ok: false, error: "Invalid multipart form data", code: "INVALID_BODY" };
  }

  // 2. Require an "image" field
  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return {
      ok:    false,
      error: 'Missing required field "image". Send the image file in a multipart field named "image".',
      code:  "MISSING_FILE",
    };
  }

  // 3. File size check (fast — before reading the buffer)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok:    false,
      error: `File too large. Maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      code:  "FILE_TOO_LARGE",
    };
  }

  if (file.size === 0) {
    return { ok: false, error: "File is empty.", code: "EMPTY_FILE" };
  }

  // 4. MIME type check from Content-Type header (fast path)
  const claimedMime = file.type?.toLowerCase() ?? "";
  if (!isSupportedMimeType(claimedMime)) {
    return {
      ok:    false,
      error: `Unsupported file type "${claimedMime}". Accepted types: JPEG, PNG, WEBP, HEIC, PDF.`,
      code:  "UNSUPPORTED_MIME",
    };
  }

  // 5. Read buffer and verify magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const uint8       = new Uint8Array(arrayBuffer);
  const buffer      = Buffer.from(arrayBuffer);

  const detectedMime = detectMimeFromBuffer(uint8);

  if (!detectedMime) {
    return {
      ok:    false,
      error: "File content does not match a supported image format. The file may be corrupt.",
      code:  "INVALID_FILE_CONTENT",
    };
  }

  // Allow minor mismatches like "image/jpg" vs "image/jpeg"
  if (
    detectedMime !== claimedMime &&
    !(claimedMime === "image/jpg" && detectedMime === "image/jpeg")
  ) {
    return {
      ok:    false,
      error: `File content (${detectedMime}) does not match declared type (${claimedMime}).`,
      code:  "MIME_MISMATCH",
    };
  }

  return { ok: true, file, buffer, detectedMime };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const scanStart = Date.now();
  const scanId    = generateScanId();

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // ── 2. Extract and validate the uploaded file ─────────────────────────────
  const fileResult = await extractAndValidateFile(request);
  if (!fileResult.ok) {
    return badRequestResponse(fileResult.error, fileResult.code);
  }

  const { buffer, detectedMime } = fileResult;

  // ── 3. OCR extraction ─────────────────────────────────────────────────────
  let ocrResult;
  try {
    const ocrProvider = getOCRProvider();
    ocrResult = await ocrProvider.extractText(buffer, detectedMime);
  } catch (err) {
    if (err instanceof OCRError) {
      console.error(`[scanner] OCR failed for user ${userId} (${scanId}):`, err.message);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `OCR processing failed: ${err.message}`,
            code:    err.code,
          },
        },
        { status: 422 }
      );
    }
    console.error(`[scanner] Unexpected OCR error for user ${userId} (${scanId}):`, err);
    return serverErrorResponse("OCR processing encountered an unexpected error.");
  }

  // ── 4. Text parsing ───────────────────────────────────────────────────────
  const parseResult = parseMedicinesFromText(ocrResult.rawText);

  // ── 5. Medicine validation + interaction detection ────────────────────────
  let batchValidation;
  try {
    batchValidation = await validateMedicines(
      parseResult.medicines.map((m) => ({ name: m.name, dosage: m.dosage }))
    );
  } catch (err) {
    console.error(`[scanner] Validation error for user ${userId} (${scanId}):`, err);
    return serverErrorResponse("Medicine validation encountered an unexpected error.");
  }

  // ── 6. Merge parsed + validated data ─────────────────────────────────────
  const medicines = parseResult.medicines.map((parsed, idx) => {
    const validation = batchValidation.results[idx];
    return {
      // ── Parsed fields ────────────────────────────────────────────
      name:        parsed.name,
      dosage:      parsed.dosage,
      frequency:   parsed.frequency,
      route:       parsed.route,
      prescriber:  parsed.prescriber,
      refillDate:  parsed.refillDate,
      // ── Validation fields ────────────────────────────────────────
      exists:               validation.exists,
      canonicalName:        validation.canonicalName,
      genericName:          validation.genericName,
      confidence:           validation.confidence,
      category:             validation.category,
      sideEffects:          validation.sideEffects,
      foodInteractions:     validation.foodInteractions,
      warnings:             validation.warnings,
      requiresPrescription: validation.requiresPrescription,
    };
  });

  const totalProcessingTimeMs = Date.now() - scanStart;

  // ── 7. Log summary (non-blocking) ────────────────────────────────────────
  console.info(
    `[scanner] ${scanId} user=${userId} provider=${ocrResult.provider} ` +
      `medicines=${medicines.length} interactions=${batchValidation.interactions.length} ` +
      `ocrConfidence=${ocrResult.confidence} totalMs=${totalProcessingTimeMs}`
  );

  // ── 8. Respond ────────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    data: {
      scanId,
      rawText:            ocrResult.rawText,
      sanitisedText:      parseResult.sanitisedText,
      ocrConfidence:      ocrResult.confidence,
      ocrProvider:        ocrResult.provider,
      ocrProcessingTimeMs: ocrResult.processingTimeMs,
      totalProcessingTimeMs,
      medicineCount:      medicines.length,
      medicines,
      interactions:       batchValidation.interactions,
    },
  });
}

// ─── Only POST is allowed ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message: "Use POST /api/scanner to submit an image for scanning.",
        code:    "METHOD_NOT_ALLOWED",
      },
    },
    { status: 405 }
  );
}