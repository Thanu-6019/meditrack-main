// src/app/api/scanner/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scanner
//
// Pipeline:  Upload → OCR Provider → Gemini AI Analysis → Structured Response
//
// Uses the OCR provider abstraction (getOCRProvider) so the underlying engine
// can be swapped via OCR_PROVIDER env var without touching this file.
//
// SECURITY: Requires valid JWT. userId always from JWT, never body.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getIdentityFromRequest }   from "@/lib/auth-context";
import {
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/auth";
import { getOCRProvider, OCRError, isSupportedMimeType } from "@/lib/ocr";
import { getMedicineAnalyzer }                            from "@/lib/ai/medicine-analyzer";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── OCR error → HTTP status mapping ─────────────────────────────────────────

function ocrErrorToStatus(err: OCRError): number {
  switch (err.code) {
    case "IMAGE_TOO_LARGE":    return 413;
    case "UNSUPPORTED_FORMAT": return 415;
    case "TIMEOUT":            return 504;
    case "LOW_QUALITY":        return 422;
    default:                   return 422;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const scanStart = Date.now();
  const scanId    = `scan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  // 1. Auth
  const identity = getIdentityFromRequest(request);
  if (!identity.ok) return unauthorizedResponse(identity.reason);
  const { userId } = identity.data;

  // 2. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequestResponse("Invalid multipart form data", "INVALID_BODY");
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return badRequestResponse(
      'Missing required field "image". Send the image file in a multipart field named "image".',
      "MISSING_FILE"
    );
  }

  if (file.size === 0) {
    return badRequestResponse("File is empty.", "EMPTY_FILE");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return badRequestResponse(
      `File too large. Maximum: ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      "FILE_TOO_LARGE"
    );
  }

  const mimeType = (file.type?.toLowerCase() ?? "image/jpeg") as string;
  if (!isSupportedMimeType(mimeType)) {
    return badRequestResponse(
      `Unsupported file type "${mimeType}". Accepted: JPEG, PNG, WEBP, HEIC, PDF.`,
      "UNSUPPORTED_MIME"
    );
  }

  // 3. Read buffer
  const arrayBuffer = await file.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // 4. OCR via the configured provider
  const ocrProvider = getOCRProvider();
  let ocrResult: { rawText: string; confidence: number };

  try {
    const result = await ocrProvider.extractText(imageBuffer, mimeType);
    ocrResult = { rawText: result.rawText, confidence: result.confidence };
  } catch (err) {
    console.error(`[scanner] OCR failed user=${userId} scanId=${scanId}:`, err);

    if (err instanceof OCRError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `OCR processing failed: ${err.message}`,
            code:    err.code,
          },
        },
        { status: ocrErrorToStatus(err) }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: "OCR processing failed. Please try again with a clearer image.",
          code:    "OCR_FAILED",
        },
      },
      { status: 422 }
    );
  }

  if (!ocrResult.rawText?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Could not extract any text from the image. Please try a clearer photo with good lighting.",
          code:    "NO_TEXT_EXTRACTED",
        },
      },
      { status: 422 }
    );
  }

  // 5. AI Medicine Analysis via Gemini
  const analyzer = getMedicineAnalyzer();
  let aiAnalysis;

  try {
    aiAnalysis = await analyzer.analyze(ocrResult.rawText);
  } catch (err) {
    console.error(`[scanner] AI analysis failed user=${userId} scanId=${scanId}:`, err);

    // Degrade gracefully: return OCR text without AI analysis so the user
    // can still manually verify and add the medicine.
    aiAnalysis = {
      medicineName:            null,
      normalizedMedicineName:  null,
      genericName:             null,
      dosage:                  null,
      frequency:               null,
      frequencyCode:           "once_daily",
      duration:                null,
      prescribedBy:            null,
      instructions:            null,
      warnings:                ["AI analysis unavailable — please verify all fields manually."],
      category:                null,
      confidence:              ocrResult.confidence * 0.5,
      ocrCorrectionsMade:      false,
      rawAnalysis:             err instanceof Error ? err.message : "AI analysis error",
    };
  }

  const totalProcessingTimeMs = Date.now() - scanStart;

  console.info(
    `[scanner] ${scanId} user=${userId} provider=${ocrProvider.name} ` +
    `ocrConf=${ocrResult.confidence.toFixed(2)} aiConf=${aiAnalysis.confidence.toFixed(2)} ` +
    `medicine=${aiAnalysis.normalizedMedicineName ?? "unknown"} ` +
    `ms=${totalProcessingTimeMs}`
  );

  // 6. Return combined result
  return NextResponse.json({
    success: true,
    data: {
      scanId,
      rawText:         ocrResult.rawText,
      ocrConfidence:   ocrResult.confidence,
      ocrProvider:     ocrProvider.name,
      aiAnalysis,
      overallConfidence: Math.round(
        (ocrResult.confidence * 0.4 + aiAnalysis.confidence * 0.6) * 100
      ) / 100,
      processingTimeMs: totalProcessingTimeMs,
    },
  });
}

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