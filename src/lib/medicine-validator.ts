// src/lib/medicine-validator.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicine validator — checks parsed medicine names against a known-medicine
// database and detects potential drug-drug interactions.
//
// CURRENT IMPLEMENTATION: mock database (flat arrays + Maps).
// FUTURE UPGRADE: swap `lookupMedicine()` and `lookupInteractions()` to call
// RxNorm, OpenFDA, or DrugBank without changing any route handler code.
//
// ARCHITECTURE NOTES
// ─────────────────────────────────────────────────────────────────────────────
// • `validateMedicine(name, dosage?)` — validates a single medicine.
// • `validateMedicines(list)` — validates an array, adds cross-drug interaction warnings.
// • All external data access is behind the `MedicineDatabase` interface.
// • `MockMedicineDatabase` implements that interface using hardcoded data.
// • `getMedicineDatabase()` factory (similar to `getOCRProvider()`) returns
//   the configured implementation.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  /**
   * Whether this name matched a known medicine in the database.
   * false does NOT mean the medicine is fake — just that it's unrecognised.
   */
  exists: boolean;

  /**
   * Name as stored in the database (may differ in casing from input).
   * null if `exists` is false.
   */
  canonicalName: string | null;

  /**
   * Generic / INN name, e.g. "Metformin Hydrochloride".
   * null if unknown or not in the database.
   */
  genericName: string | null;

  /**
   * How confident we are in the match, 0–1.
   * 1.0 = exact match, 0.8 = case-insensitive, 0.6 = partial / fuzzy.
   * 0.0 = no match found.
   */
  confidence: number;

  /**
   * Drug category / class, e.g. "Antidiabetic", "ACE Inhibitor".
   */
  category: string | null;

  /**
   * Common, well-known side effects.
   */
  sideEffects: string[];

  /**
   * Known drug-food interactions for this medicine alone.
   */
  foodInteractions: string[];

  /**
   * Warnings specific to this medicine (e.g. "Do not use in renal impairment").
   */
  warnings: string[];

  /**
   * Requires a prescription in most jurisdictions.
   */
  requiresPrescription: boolean | null;
}

export interface InteractionResult {
  /** Name of drug A. */
  drugA: string;
  /** Name of drug B. */
  drugB: string;
  /** Severity: low | moderate | high | contraindicated. */
  severity: InteractionSeverity;
  /** Plain-English description of the interaction. */
  description: string;
}

export type InteractionSeverity = "low" | "moderate" | "high" | "contraindicated";

export interface BatchValidationResult {
  /** One ValidationResult per input medicine (in same order). */
  results: ValidationResult[];
  /** All detected pairwise drug interactions across the batch. */
  interactions: InteractionResult[];
}

// ─── Database abstraction ─────────────────────────────────────────────────────

export interface MedicineDatabase {
  /**
   * Look up a medicine by name.
   * Returns null if not found.
   */
  lookup(name: string): Promise<KnownMedicine | null>;

  /**
   * Look up the interaction between two medicine names.
   * Returns null if no known interaction.
   */
  lookupInteraction(
    nameA: string,
    nameB: string
  ): Promise<InteractionResult | null>;
}

export interface KnownMedicine {
  name:                 string;   // canonical display name
  genericName:          string | null;
  category:             string | null;
  sideEffects:          string[];
  foodInteractions:     string[];
  warnings:             string[];
  requiresPrescription: boolean;
  /** All known aliases / alternate spellings for matching. */
  aliases:              string[];
}

// ─── Mock database ────────────────────────────────────────────────────────────

const KNOWN_MEDICINES: KnownMedicine[] = [
  {
    name: "Metformin",
    genericName: "Metformin Hydrochloride",
    category: "Antidiabetic",
    sideEffects: ["Nausea", "Stomach upset", "Diarrhea", "Lactic acidosis (rare)"],
    foodInteractions: ["Alcohol (increases lactic acidosis risk)"],
    warnings: ["Avoid in severe renal impairment (eGFR < 30)", "Hold before contrast dye procedures"],
    requiresPrescription: true,
    aliases: ["metformin", "metformin hcl", "metformin hydrochloride", "glucophage"],
  },
  {
    name: "Lisinopril",
    genericName: "Lisinopril",
    category: "ACE Inhibitor",
    sideEffects: ["Dry cough", "Dizziness", "Headache", "Hyperkalaemia"],
    foodInteractions: ["Potassium-rich foods (may increase blood potassium)"],
    warnings: ["Contraindicated in pregnancy", "Monitor renal function", "Avoid NSAIDs"],
    requiresPrescription: true,
    aliases: ["lisinopril", "prinivil", "zestril"],
  },
  {
    name: "Atorvastatin",
    genericName: "Atorvastatin Calcium",
    category: "Statin",
    sideEffects: ["Muscle pain (myalgia)", "Liver enzyme elevation", "Headache"],
    foodInteractions: ["Grapefruit juice (increases drug levels)"],
    warnings: ["Monitor liver enzymes", "Report unexplained muscle pain immediately"],
    requiresPrescription: true,
    aliases: ["atorvastatin", "atorvastatin calcium", "lipitor"],
  },
  {
    name: "Vitamin D3",
    genericName: "Cholecalciferol",
    category: "Supplement",
    sideEffects: ["Rare at standard doses", "Hypercalcaemia (overdose)"],
    foodInteractions: [],
    warnings: ["Take with a fatty meal for best absorption"],
    requiresPrescription: false,
    aliases: ["vitamin d3", "cholecalciferol", "vitamin d", "vit d3", "vit d"],
  },
  {
    name: "Aspirin",
    genericName: "Acetylsalicylic Acid",
    category: "NSAID / Antiplatelet",
    sideEffects: ["GI irritation", "Bleeding risk", "Tinnitus (high doses)"],
    foodInteractions: ["Alcohol (increases bleeding risk)"],
    warnings: ["Avoid in children under 16 (Reye syndrome risk)", "Monitor for GI bleeding"],
    requiresPrescription: false,
    aliases: ["aspirin", "acetylsalicylic acid", "asa", "bayer"],
  },
  {
    name: "Paracetamol",
    genericName: "Acetaminophen",
    category: "Analgesic / Antipyretic",
    sideEffects: ["Liver damage in overdose"],
    foodInteractions: ["Alcohol (increases hepatotoxicity risk)"],
    warnings: ["Do not exceed 4 g/day", "Check all other products for paracetamol content"],
    requiresPrescription: false,
    aliases: ["paracetamol", "acetaminophen", "tylenol", "panadol"],
  },
  {
    name: "Ibuprofen",
    genericName: "Ibuprofen",
    category: "NSAID",
    sideEffects: ["GI irritation", "Headache", "Dizziness", "Fluid retention"],
    foodInteractions: ["Alcohol (GI bleed risk)"],
    warnings: ["Avoid in renal impairment", "Take with food or milk", "Avoid in late pregnancy"],
    requiresPrescription: false,
    aliases: ["ibuprofen", "advil", "nurofen", "motrin"],
  },
  {
    name: "Omeprazole",
    genericName: "Omeprazole",
    category: "Proton Pump Inhibitor",
    sideEffects: ["Headache", "Diarrhea", "Nausea", "Low magnesium (long-term)"],
    foodInteractions: [],
    warnings: ["Take 30 min before meals", "Long-term use may reduce B12 absorption"],
    requiresPrescription: false,
    aliases: ["omeprazole", "prilosec", "losec"],
  },
  {
    name: "Amoxicillin",
    genericName: "Amoxicillin Trihydrate",
    category: "Antibiotic (Penicillin)",
    sideEffects: ["Diarrhea", "Nausea", "Rash", "Allergic reaction"],
    foodInteractions: [],
    warnings: ["Complete the full course", "Contraindicated in penicillin allergy"],
    requiresPrescription: true,
    aliases: ["amoxicillin", "amoxil", "trimox"],
  },
  {
    name: "Metoprolol",
    genericName: "Metoprolol Succinate",
    category: "Beta-Blocker",
    sideEffects: ["Fatigue", "Dizziness", "Bradycardia", "Cold extremities"],
    foodInteractions: [],
    warnings: ["Do not stop abruptly (rebound hypertension)", "Monitor heart rate"],
    requiresPrescription: true,
    aliases: ["metoprolol", "metoprolol succinate", "metoprolol tartrate", "lopressor", "toprol"],
  },
  {
    name: "Amlodipine",
    genericName: "Amlodipine Besylate",
    category: "Calcium Channel Blocker",
    sideEffects: ["Ankle swelling", "Flushing", "Headache", "Dizziness"],
    foodInteractions: ["Grapefruit juice (slightly increases drug levels)"],
    warnings: ["May cause peripheral oedema"],
    requiresPrescription: true,
    aliases: ["amlodipine", "amlodipine besylate", "norvasc"],
  },
  {
    name: "Rosuvastatin",
    genericName: "Rosuvastatin Calcium",
    category: "Statin",
    sideEffects: ["Muscle pain", "Headache", "Liver enzyme elevation"],
    foodInteractions: [],
    warnings: ["Monitor liver function", "Avoid in severe renal impairment"],
    requiresPrescription: true,
    aliases: ["rosuvastatin", "rosuvastatin calcium", "crestor"],
  },
];

/**
 * Known pairwise drug interactions.
 * Keys are sorted alphabetically: `${nameA.lower}::${nameB.lower}`.
 */
const KNOWN_INTERACTIONS = new Map<string, InteractionResult>([
  [
    interactionKey("Metformin", "Alcohol"),
    {
      drugA: "Metformin",
      drugB: "Alcohol",
      severity: "high",
      description:
        "Concurrent alcohol use with Metformin significantly increases the risk of lactic acidosis, a rare but potentially fatal condition.",
    },
  ],
  [
    interactionKey("Aspirin", "Ibuprofen"),
    {
      drugA: "Aspirin",
      drugB: "Ibuprofen",
      severity: "moderate",
      description:
        "Ibuprofen can reduce the antiplatelet effect of low-dose aspirin when taken together. Take aspirin at least 2 hours before ibuprofen.",
    },
  ],
  [
    interactionKey("Lisinopril", "Ibuprofen"),
    {
      drugA: "Lisinopril",
      drugB: "Ibuprofen",
      severity: "moderate",
      description:
        "NSAIDs like ibuprofen can reduce the blood-pressure-lowering effect of ACE inhibitors and may worsen renal function.",
    },
  ],
  [
    interactionKey("Atorvastatin", "Amlodipine"),
    {
      drugA: "Atorvastatin",
      drugB: "Amlodipine",
      severity: "low",
      description:
        "Amlodipine may slightly increase atorvastatin levels. Doses above 40 mg atorvastatin should be used with caution.",
    },
  ],
  [
    interactionKey("Metoprolol", "Amlodipine"),
    {
      drugA: "Metoprolol",
      drugB: "Amlodipine",
      severity: "low",
      description:
        "Both drugs lower blood pressure; additive hypotensive effect. Usually intentional but monitor for excessive bradycardia.",
    },
  ],
  [
    interactionKey("Omeprazole", "Metformin"),
    {
      drugA: "Omeprazole",
      drugB: "Metformin",
      severity: "low",
      description:
        "Long-term PPI use may slightly increase metformin plasma levels. Monitor blood glucose.",
    },
  ],
  [
    interactionKey("Aspirin", "Metformin"),
    {
      drugA: "Aspirin",
      drugB: "Metformin",
      severity: "low",
      description:
        "High-dose salicylates may enhance the blood-glucose-lowering effect of metformin. Low-dose aspirin (81 mg) is generally safe.",
    },
  ],
]);

function interactionKey(a: string, b: string): string {
  return [a.toLowerCase(), b.toLowerCase()].sort().join("::");
}

// ─── MockMedicineDatabase ────────────────────────────────────────────────────

export class MockMedicineDatabase implements MedicineDatabase {
  private readonly _byAlias: Map<string, KnownMedicine>;

  constructor() {
    this._byAlias = new Map();
    for (const med of KNOWN_MEDICINES) {
      for (const alias of med.aliases) {
        this._byAlias.set(alias.toLowerCase(), med);
      }
    }
  }

  async lookup(name: string): Promise<KnownMedicine | null> {
    const key = name.trim().toLowerCase();

    // 1. Exact alias match
    const exact = this._byAlias.get(key);
    if (exact) return exact;

    // 2. Partial / starts-with match (handles "Metformin HCl" → "Metformin")
    for (const [alias, med] of this._byAlias) {
      if (key.startsWith(alias) || alias.startsWith(key)) {
        return med;
      }
    }

    return null;
  }

  async lookupInteraction(nameA: string, nameB: string): Promise<InteractionResult | null> {
    const key = interactionKey(nameA, nameB);
    return KNOWN_INTERACTIONS.get(key) ?? null;
  }
}

// ─── Database factory ─────────────────────────────────────────────────────────

let _cachedDb: MedicineDatabase | null = null;

/**
 * Returns the configured medicine database.
 * Swap the implementation here when integrating RxNorm / OpenFDA / DrugBank.
 */
export function getMedicineDatabase(): MedicineDatabase {
  if (_cachedDb) return _cachedDb;

  const provider = (process.env.MEDICINE_DB_PROVIDER ?? "mock").toLowerCase();

  switch (provider) {
    case "mock":
      _cachedDb = new MockMedicineDatabase();
      break;

    // case "rxnorm":
    //   _cachedDb = new RxNormDatabase({ apiKey: process.env.RXNORM_API_KEY! });
    //   break;

    // case "openfda":
    //   _cachedDb = new OpenFDADatabase({ apiKey: process.env.OPENFDA_API_KEY! });
    //   break;

    default:
      console.warn(
        `[medicine-validator] Unknown MEDICINE_DB_PROVIDER "${provider}", falling back to mock.`
      );
      _cachedDb = new MockMedicineDatabase();
  }

  return _cachedDb;
}

export function resetMedicineDatabaseCache(): void {
  _cachedDb = null;
}

// ─── Validation helpers ────────────────────────────────────────────────────────

/**
 * Determines match confidence based on how the name was found.
 */
function matchConfidence(
  inputName:     string,
  canonicalName: string | null,
  matched:       KnownMedicine | null
): number {
  if (!matched || !canonicalName) return 0;

  const input    = inputName.trim().toLowerCase();
  const canon    = canonicalName.toLowerCase();

  if (input === canon) return 1.0;                      // exact
  if (matched.aliases.includes(input)) return 0.95;    // alias
  if (canon.startsWith(input) || input.startsWith(canon)) return 0.80; // partial
  return 0.65;                                           // fuzzy
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a single medicine name against the database.
 *
 * ```ts
 * const result = await validateMedicine("Metformin", "500 mg");
 * // {
 * //   exists: true,
 * //   canonicalName: "Metformin",
 * //   confidence: 1.0,
 * //   warnings: ["Avoid in severe renal impairment..."],
 * //   ...
 * // }
 * ```
 */
export async function validateMedicine(
  name:   string,
  dosage?: string | null
): Promise<ValidationResult> {
  const db      = getMedicineDatabase();
  const matched = await db.lookup(name);

  const warnings: string[] = [...(matched?.warnings ?? [])];

  // Add a dosage-specific warning if dosage looks unusually high
  if (dosage && matched) {
    const numericDose = parseFloat(dosage.replace(/[^\d.]/g, ""));
    if (!isNaN(numericDose) && numericDose > 2000) {
      warnings.push(
        `Dosage ${dosage} appears unusually high. Please verify with your prescriber.`
      );
    }
  }

  return {
    exists:               !!matched,
    canonicalName:        matched?.name ?? null,
    genericName:          matched?.genericName ?? null,
    confidence:           matchConfidence(name, matched?.name ?? null, matched),
    category:             matched?.category ?? null,
    sideEffects:          matched?.sideEffects ?? [],
    foodInteractions:     matched?.foodInteractions ?? [],
    warnings,
    requiresPrescription: matched?.requiresPrescription ?? null,
  };
}

/**
 * Validates an array of parsed medicines and checks for pairwise interactions.
 * Returns one `ValidationResult` per input item, plus all interaction pairs.
 *
 * ```ts
 * const { results, interactions } = await validateMedicines([
 *   { name: "Metformin", dosage: "500 mg" },
 *   { name: "Ibuprofen", dosage: "400 mg" },
 * ]);
 * ```
 */
export async function validateMedicines(
  medicines: Array<{ name: string; dosage?: string | null }>
): Promise<BatchValidationResult> {
  const db = getMedicineDatabase();

  // 1. Validate each medicine independently
  const results = await Promise.all(
    medicines.map((m) => validateMedicine(m.name, m.dosage))
  );

  // 2. Check all pairwise interactions
  const interactions: InteractionResult[] = [];
  const names = medicines.map((m) => m.name);

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const interaction = await db.lookupInteraction(names[i], names[j]);
      if (interaction) {
        interactions.push(interaction);
      }
    }
  }

  return { results, interactions };
}