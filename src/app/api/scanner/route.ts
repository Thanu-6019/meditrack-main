// src/app/api/scanner/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scanner
//
// Pipeline: Upload → OCR.space → Gemini AI Analysis → Structured Response
//
// SECURITY: Requires valid JWT. userId always from JWT, never body.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getIdentityFromRequest } from "@/lib/auth-context";
import {
  unauthorizedResponse,
  badRequestResponse,
  serverErrorResponse,
} from "@/lib/auth";
import { getMedicineAnalyzer } from "@/lib/ai/medicine-analyzer";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

function isSupportedMime(mime: string): boolean {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
}

// ─── OCR via OCR.space ────────────────────────────────────────────────────────

async function runOcrSpace(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ rawText: string; confidence: number }> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? "helloworld";

  const formData = new FormData();
  formData.append("apikey", apiKey);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2");

  const ext = mimeType.includes("pdf") ? "pdf" : mimeType.split("/")[1].replace("jpeg", "jpg");
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("file", blob, `prescription.${ext}`);
  formData.append("file", blob, `prescription.${ext}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`OCR.space HTTP ${res.status}`);
  }

  const json: any = await res.json();

  if (json.IsErroredOnProcessing) {
    throw new Error(json.ErrorMessage?.[0] ?? "OCR processing error");
  }

  const parsed: any[] = json.ParsedResults ?? [];
  if (!parsed.length) {
    throw new Error("OCR returned no results");
  }

  const rawText = parsed.map((r: any) => r.ParsedText ?? "").join("\n").trim();
  const exitCode: number = parsed[0]?.FileParseExitCode ?? 1;
  const confidence = exitCode === 1 ? 0.92 : exitCode === 2 ? 0.70 : 0.50;

  return { rawText, confidence };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const scanStart = Date.now();
  const scanId = `scan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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

  const mimeType = file.type?.toLowerCase() ?? "image/jpeg";
  if (!isSupportedMime(mimeType)) {
    return badRequestResponse(
      `Unsupported file type "${mimeType}". Accepted: JPEG, PNG, WEBP, HEIC, PDF.`,
      "UNSUPPORTED_MIME"
    );
  }

  // 3. Read buffer
  const arrayBuffer = await file.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // 4. OCR
  let ocrResult: { rawText: string; confidence: number };
  try {
    ocrResult = await runOcrSpace(imageBuffer, mimeType);
  } catch (err: any) {
    console.error(`[scanner] OCR failed for user ${userId} (${scanId}):`, err.message);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: `OCR processing failed: ${err.message}`,
          code: "OCR_FAILED",
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
          message: "Could not extract any text from the image. Please try a clearer photo.",
          code: "NO_TEXT_EXTRACTED",
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
  } catch (err: any) {
    console.error(`[scanner] AI analysis failed for user ${userId} (${scanId}):`, err.message);
    // Degrade gracefully — return OCR text without AI analysis
    aiAnalysis = {
      medicineName: null,
      normalizedMedicineName: null,
      genericName: null,
      dosage: null,
      frequency: null,
      frequencyCode: "once_daily",
      duration: null,
      prescribedBy: null,
      instructions: null,
      warnings: [],
      category: null,
      confidence: ocrResult.confidence * 0.5,
      ocrCorrectionsMade: false,
      rawAnalysis: `AI analysis unavailable: ${err.message}`,
    };
  }

  const totalProcessingTimeMs = Date.now() - scanStart;

  console.info(
    `[scanner] ${scanId} user=${userId} ` +
      `ocrConfidence=${ocrResult.confidence} aiConfidence=${aiAnalysis.confidence} ` +
      `medicine=${aiAnalysis.normalizedMedicineName ?? "unknown"} ` +
      `totalMs=${totalProcessingTimeMs}`
  );

  // 6. Return combined result
  return NextResponse.json({
    success: true,
    data: {
      scanId,
      // OCR data
      rawText: ocrResult.rawText,
      ocrConfidence: ocrResult.confidence,
      ocrProvider: "ocr_space",
      // AI analysis
      aiAnalysis,
      // Combined confidence (weighted average)
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
        code: "METHOD_NOT_ALLOWED",
      },
    },
    { status: 405 }
  );
}