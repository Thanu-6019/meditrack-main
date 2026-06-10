// src/lib/medicine-parser.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicine parser — turns raw OCR text into structured medicine records.
//
// DESIGN NOTES
// ─────────────────────────────────────────────────────────────────────────────
// • Zero external dependencies — pure regex + heuristics.
// • Multiple medicines per scan are extracted (e.g. a blister pack with 3 drugs).
// • Parsing is intentionally tolerant: OCR output is noisy, so we prefer
//   false positives (reviewed by user) over false negatives (missed medicine).
// • Each stage is a small, independently testable function.
//
// FUTURE UPGRADE PATH
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: replace `parseMedicinesFromText` with an LLM call that uses the
// raw OCR text as context. The `ParsedMedicine` type stays the same.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ParsedMedicine {
/** Normalised medicine name (Title Case, no trailing punctuation). */
name: string;

/**

* Dosage string, e.g. "500 mg", "10 mg", "2000 IU".
* null if not found in the source text.
  */
  dosage: string | null;

/**

* Dosing frequency, e.g. "twice daily", "once daily", "three times daily".
* null if not found.
  */
  frequency: string | null;

/**

* Route of administration, e.g. "oral", "topical".
* null if not found.
  */
  route: string | null;

/**

* Prescriber name, e.g. "Dr. Sarah Chen".
* null if not found.
  */
  prescriber: string | null;

/**

* Refill / expiry date string as it appears in the source text.
* Not parsed to a Date so the user can review it.
  */
  refillDate: string | null;

/** The raw source line(s) that produced this record, for debugging. */
sourceLines: string[];
}

export interface MedicineParseResult {
/** All medicines detected in the text. May be empty. */
medicines: ParsedMedicine[];

/** Pre-processed, sanitised version of the raw text. */
sanitisedText: string;

/** The number of lines in the sanitised text that were parsed as medicine names. */
matchedLineCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Well-known dosage units used to anchor medicine name extraction. */
const DOSAGE_UNITS = [
"mg",
"mcg",
"µg",
"ug",
"g",
"ml",
"l",
"iu",
"units",
"unit",
"mEq",
"meq",
"mmol",
"%",
] as const;

const DOSAGE_UNIT_PATTERN = DOSAGE_UNITS.join("|");

/**

* Matches a medicine name followed immediately by a dosage.
* Examples: "METFORMIN 500MG", "Metformin HCl 500 mg", "Vitamin D3 2000IU"
  */
  const MEDICINE_WITH_DOSAGE_RE = new RegExp(
  // Group 1: medicine name — 2–5 capitalised-ish words
  `([A-Z][A-Za-z0-9\\-]+(\\s+[A-Za-z0-9\\-]+){0,4}?)` +
  // Group 3: dosage — number(s) + unit
  `\\s+(\\d+(?:[\\.,]\\d+)?(?:\\/\\d+(?:[\\.,]\\d+)?)?)\\s*(${DOSAGE_UNIT_PATTERN})\\b`,
  "gi"
  );

/**

* Standalone dosage patterns used for extraction after a name is found.
* e.g. "500mg", "10 mg", "2000 IU", "1.5 ml"
  */
  const DOSAGE_RE = new RegExp(
  `(\\d+(?:[\\.,]\\d+)?(?:\\/\\d+(?:[\\.,]\\d+)?)?)\\s*(${DOSAGE_UNIT_PATTERN})\\b`,
  "i"
  );

/** Frequency patterns in order of specificity. */
const FREQUENCY_PATTERNS: Array<{ re: RegExp; label: string }> = [
{ re: /four\s+times?\s+(a\s+)?day|4\s+times?\s+(a\s+)?day|q.?i.?d.?/i,        label: "four times daily" },
{ re: /three\s+times?\s+(a\s+)?day|3\s+times?\s+(a\s+)?day|t.?i.?d.?/i,       label: "three times daily" },
{ re: /twice\s+(a\s+)?day|two\s+times?\s+(a\s+)?day|b.?i.?d.?|2x\s+daily/i,   label: "twice daily" },
{ re: /once\s+(a\s+)?(day|daily)|1\s+time?\s+(a\s+)?day|q.?d.?|every\s+day/i,  label: "once daily" },
{ re: /every\s+other\s+day|alternate\s+days?|e.?o.?d.?/i,                       label: "every other day" },
{ re: /once\s+a\s+week|weekly|once\s+weekly/i,                                      label: "weekly" },
{ re: /as\s+needed|p.?r.?n.?|when\s+needed/i,                                   label: "as needed" },
{ re: /at\s+bedtime|at\s+night|nightly|q.?h.?s.?/i,                             label: "at bedtime" },
{ re: /in\s+the\s+morning|every\s+morning/i,                                        label: "every morning" },
];

/** Route of administration patterns. */
const ROUTE_PATTERNS: Array<{ re: RegExp; label: string }> = [
{ re: /by\s+mouth|orally?|oral|p.?o.?/i,   label: "oral" },
{ re: /topical|apply\s+to/i,                   label: "topical" },
{ re: /inhal|inhale|spray/i,                   label: "inhalation" },
{ re: /inject|subcutaneous|intramuscular/i,    label: "injection" },
{ re: /sublingual|under\s+the\s+tongue/i,      label: "sublingual" },
{ re: /rectal|suppository/i,                   label: "rectal" },
{ re: /ophthalmic|eye\s+drops?/i,              label: "ophthalmic" },
{ re: /otic|ear\s+drops?/i,                    label: "otic" },
{ re: /nasal|nose\s+drops?/i,                  label: "nasal" },
];

/** Prescriber line patterns. */
const PRESCRIBER_RE =
/(?:prescrib(?:er|ed\s+by)|dr.?|doctor|physician|physician)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+)/i;

/** Refill / expiry date patterns. */
const REFILL_DATE_RE =
/(?:refill(?:\s+(?:by|date|until))?|exp(?:iry|ires?)?|use\s+before)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{4})/i;

/**

* Words that commonly appear next to medicine names in labels but are NOT
* medicine names themselves. Filtered out to reduce false positives.
  */
  const STOP_WORDS = new Set([
  "take", "tablet", "tablets", "capsule", "capsules", "softgel", "softgels",
  "film", "coated", "delayed", "release", "extended", "pack", "each", "contains",
  "warning", "store", "keep", "mfr", "batch", "exp", "date", "rx", "qty",
  "refills", "remaining", "prescriber", "patient", "pharmacy", "tel", "date",
  "filled", "sig", "dosage", "directions", "adults", "children",
  ]);

// ─── Text sanitisation ────────────────────────────────────────────────────────

/**

* Cleans raw OCR output before parsing:
* • Normalises line endings
* • Strips control characters
* • Collapses excessive whitespace
* • Removes lines that are purely non-alphanumeric noise
*
* Does NOT remove potentially meaningful text — the parser handles noise.
  */
  export function sanitiseOCRText(rawText: string): string {
  return rawText
  // Normalise CRLF and CR to LF
  .replace(/\r\n?/g, "\n")
  // Strip NUL and other control chars except tab + newline
  .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
  // Collapse runs of spaces/tabs to a single space (preserve newlines)
  .replace(/[^\S\n]+/g, " ")
  // Drop lines that are purely symbols / numbers with no alphabetic content
  .split("\n")
  .filter((line) => /[A-Za-z]/.test(line))
  .join("\n")
  .trim();
  }

// ─── Core extraction helpers ──────────────────────────────────────────────────

/**

* Extracts all medicine name+dosage pairs from the sanitised text.
* Returns an array of partial ParsedMedicine objects (name + dosage only).
  */
  function extractMedicineNameDosagePairs(
  text: string
  ): Array<{ name: string; dosage: string; sourceLines: string[] }> {
  const results: Array<{ name: string; dosage: string; sourceLines: string[] }> = [];
  const seen = new Set<string>();

// Reset lastIndex before global regex use
MEDICINE_WITH_DOSAGE_RE.lastIndex = 0;

let match: RegExpExecArray | null;

while ((match = MEDICINE_WITH_DOSAGE_RE.exec(text)) !== null) {
const rawName  = match[1].trim();
const quantity = match[3].trim();
const unit     = match[5].toLowerCase();


const name   = normaliseMedicineName(rawName);
const dosage = `${quantity} ${unit}`.trim();

if (!name || STOP_WORDS.has(name.toLowerCase())) continue;

const key = `${name.toLowerCase()}:${dosage.toLowerCase()}`;
if (seen.has(key)) continue;
seen.add(key);

// Find the source line(s) by looking backwards from the match index
const sourceLines = findSourceLines(text, match.index, match[0].length);

results.push({ name, dosage, sourceLines });


}

return results;
}

/**

* Extracts the frequency string from the full text.
* Returns the first match found (assumes one overall dosing instruction).
  */
  function extractFrequency(text: string): string | null {
  for (const { re, label } of FREQUENCY_PATTERNS) {
  if (re.test(text)) return label;
  }
  return null;
  }

/**

* Extracts the route of administration from the full text.
  */
  function extractRoute(text: string): string | null {
  for (const { re, label } of ROUTE_PATTERNS) {
  if (re.test(text)) return label;
  }
  return null;
  }

/**

* Extracts the prescriber name from the text.
  */
  function extractPrescriber(text: string): string | null {
  const m = text.match(PRESCRIBER_RE);
  return m ? m[1].trim() : null;
  }

/**

* Extracts the refill / expiry date from the text.
  */
  function extractRefillDate(text: string): string | null {
  const m = text.match(REFILL_DATE_RE);
  return m ? m[1].trim() : null;
  }

// ─── Name normalisation ────────────────────────────────────────────────────────

/**

* Normalises a raw OCR medicine name:
* • Converts to Title Case
* • Removes leading/trailing punctuation and numbers
* • Cleans up common OCR substitutions (0→O, 4→A, @→A)
* • Removes noise words (tablet, capsule, etc.)
  */
  export function normaliseMedicineName(raw: string): string {
  return raw
  // Common OCR confusions in drug names (conservative — only obvious cases)
  .replace(/\b0(?=[a-z])/gi, "O") // "0mega" → "Omega"
  .replace(/\b4(?=[a-z])/gi, "A") // "4spirin" → "Aspirin" (rare)
  // Remove surrounding punctuation
  .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
  // Title case
  .split(/\s+/)
  .filter((word) => {
  const lower = word.toLowerCase();
  // Keep the word if it's NOT a stop word AND has at least 2 letters
  return word.length >= 2 && !STOP_WORDS.has(lower);
  })
  .map((word) =>
  // Preserve all-caps abbreviations (e.g. "HCl", "ER", "XR"), title-case the rest
  word === word.toUpperCase() && word.length <= 3
  ? word
  : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
  .join(" ")
  .trim();
  }

// ─── Source line finder ────────────────────────────────────────────────────────

/**

* Returns the 1–2 source lines that contain the matched text.
* Used to populate `ParsedMedicine.sourceLines` for debugging.
  */
  function findSourceLines(
  text:        string,
  matchIndex:  number,
  matchLength: number
  ): string[] {
  const before  = text.lastIndexOf("\n", matchIndex);
  const after   = text.indexOf("\n", matchIndex + matchLength);
  const lineStr = text.slice(
  before === -1 ? 0 : before + 1,
  after  === -1 ? undefined : after
  );
  return lineStr
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
  }

// ─── Main public API ──────────────────────────────────────────────────────────

/**

* Parses raw OCR text into a structured list of medicines.
*
* ```ts
  ```
* const result = parseMedicinesFromText(ocrResult.rawText);
* console.log(result.medicines);
* // [
* //   { name: "Metformin", dosage: "500 mg", frequency: "twice daily", ... },
* //   { name: "Lisinopril", dosage: "10 mg", frequency: "once daily", ... },
* // ]
* ```
  ```

*/
export function parseMedicinesFromText(rawText: string): MedicineParseResult {
// 1. Sanitise
const sanitisedText = sanitiseOCRText(rawText);

if (!sanitisedText) {
return { medicines: [], sanitisedText: "", matchedLineCount: 0 };
}

// 2. Extract shared contextual fields (apply to all medicines in this scan)
const frequency  = extractFrequency(sanitisedText);
const route      = extractRoute(sanitisedText);
const prescriber = extractPrescriber(sanitisedText);
const refillDate = extractRefillDate(sanitisedText);

// 3. Extract medicine name + dosage pairs
const pairs = extractMedicineNameDosagePairs(sanitisedText);

// 4. Build full ParsedMedicine objects
const medicines: ParsedMedicine[] = pairs.map((pair) => ({
name:        pair.name,
dosage:      pair.dosage,
frequency,
route,
prescriber,
refillDate,
sourceLines: pair.sourceLines,
}));

return {
medicines,
sanitisedText,
matchedLineCount: pairs.length,
};
}
