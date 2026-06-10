// src/lib/ocr/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// OCR provider factory.
//
// USAGE
// ─────────────────────────────────────────────────────────────────────────────
// In any server-side module (Route Handler, Server Action):
//
//   import { getOCRProvider } from "@/lib/ocr";
//   const ocr    = getOCRProvider();
//   const result = await ocr.extractText(buffer, "image/jpeg");
//
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
//   OCR_PROVIDER=mock        → MockOCRProvider (default, dev only)
//   OCR_PROVIDER=tesseract   → TesseractProvider (local, no API cost)
//   OCR_PROVIDER=google      → GoogleVisionProvider (requires GOOGLE_VISION_API_KEY)
//   OCR_PROVIDER=aws         → AWSTextractProvider (requires AWS_* env vars)
//   OCR_PROVIDER=azure       → AzureVisionProvider (requires AZURE_* env vars)
//
// ADDING A NEW PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
//   1. Create `src/lib/ocr/<name>.provider.ts` implementing `OCRProvider`.
//   2. Add a case below in `getOCRProvider()`.
//   3. Export the provider class from this file.
//   No other changes needed.
// ─────────────────────────────────────────────────────────────────────────────

import { type OCRProvider, type OCRProviderName, OCRError } from "./types";
import { mockOCRProvider, MockOCRProvider } from "./mock.provider";

// ─── Lazy-loaded provider stubs (uncomment as you implement them) ─────────────
//
// These imports are commented out because the provider files don't exist yet.
// When you implement a real provider:
//   1. Create the file (e.g. src/lib/ocr/google.provider.ts).
//   2. Uncomment the import.
//   3. Add the case in getOCRProvider().
//
// import { GoogleVisionProvider }  from "./google.provider";
// import { AWSTextractProvider }   from "./aws.provider";
// import { AzureVisionProvider }   from "./azure.provider";
// import { TesseractProvider }     from "./tesseract.provider";

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns the configured OCR provider.
 *
 * The provider is determined at call time (not module load time) so that
 * tests can change `process.env.OCR_PROVIDER` between test cases.
 *
 * The returned instance is cached after the first call for the lifetime of
 * the process (singleton per provider type).
 */

let _cachedProvider: OCRProvider | null = null;
let _cachedProviderName: OCRProviderName | null = null;

export function getOCRProvider(): OCRProvider {
  const providerName = (
    (process.env.OCR_PROVIDER ?? "mock") as string
  ).toLowerCase().trim() as OCRProviderName;

  // Return cache if same provider is still configured
  if (_cachedProvider && _cachedProviderName === providerName) {
    return _cachedProvider;
  }

  let provider: OCRProvider;

  switch (providerName) {
    // ── Mock (development default) ─────────────────────────────────────────
    case "mock":
      provider = mockOCRProvider;
      break;

    // ── Tesseract (local, no API cost) ─────────────────────────────────────
    case "tesseract":
      // TODO: implement TesseractProvider
      // import { TesseractProvider } from "./tesseract.provider";
      // provider = new TesseractProvider({
      //   languages: (process.env.TESSERACT_LANGUAGES ?? "eng").split(","),
      //   langPath:  process.env.TESSERACT_LANG_PATH,
      //   timeoutMs: parseInt(process.env.OCR_TIMEOUT_MS ?? "30000", 10),
      // });
      throw new OCRError(
        "Tesseract provider is not yet implemented. " +
          "Install tesseract.js and create src/lib/ocr/tesseract.provider.ts.",
        "PROVIDER_UNAVAILABLE",
        "tesseract"
      );

    // ── Google Cloud Vision ─────────────────────────────────────────────────
    case "google":
      // TODO: implement GoogleVisionProvider
      // import { GoogleVisionProvider } from "./google.provider";
      // const apiKey = requireEnvVar("GOOGLE_VISION_API_KEY");
      // provider = new GoogleVisionProvider({ apiKey });
      throw new OCRError(
        "Google Vision provider is not yet implemented. " +
          "Create src/lib/ocr/google.provider.ts and set GOOGLE_VISION_API_KEY.",
        "PROVIDER_UNAVAILABLE",
        "google"
      );

    // ── AWS Textract ────────────────────────────────────────────────────────
    case "aws":
      // TODO: implement AWSTextractProvider
      // import { AWSTextractProvider } from "./aws.provider";
      // provider = new AWSTextractProvider({
      //   region:          requireEnvVar("AWS_REGION"),
      //   accessKeyId:     requireEnvVar("AWS_ACCESS_KEY_ID"),
      //   secretAccessKey: requireEnvVar("AWS_SECRET_ACCESS_KEY"),
      // });
      throw new OCRError(
        "AWS Textract provider is not yet implemented. " +
          "Create src/lib/ocr/aws.provider.ts and set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.",
        "PROVIDER_UNAVAILABLE",
        "aws"
      );

    // ── Azure AI Vision ─────────────────────────────────────────────────────
    case "azure":
      // TODO: implement AzureVisionProvider
      // import { AzureVisionProvider } from "./azure.provider";
      // provider = new AzureVisionProvider({
      //   endpoint:  requireEnvVar("AZURE_VISION_ENDPOINT"),
      //   apiKey:    requireEnvVar("AZURE_VISION_API_KEY"),
      // });
      throw new OCRError(
        "Azure Vision provider is not yet implemented. " +
          "Create src/lib/ocr/azure.provider.ts and set AZURE_VISION_ENDPOINT, AZURE_VISION_API_KEY.",
        "PROVIDER_UNAVAILABLE",
        "azure"
      );

    default:
      throw new OCRError(
        `Unknown OCR provider: "${providerName}". ` +
          `Valid options: mock, tesseract, google, aws, azure.`,
        "PROVIDER_UNAVAILABLE",
        providerName as OCRProviderName
      );
  }

  _cachedProvider     = provider;
  _cachedProviderName = providerName;

  return provider;
}

/**
 * Resets the provider cache.
 * Use in tests when changing OCR_PROVIDER between test cases.
 *
 * ```ts
 * beforeEach(() => resetOCRProviderCache());
 * ```
 */
export function resetOCRProviderCache(): void {
  _cachedProvider     = null;
  _cachedProviderName = null;
}

// ─── Env helper (used internally when wiring real providers) ─────────────────

function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable for OCR provider: ${key}`
    );
  }
  return value;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

// Re-export everything from types so consumers only need one import path.
export * from "./types";
export { MockOCRProvider, mockOCRProvider } from "./mock.provider";