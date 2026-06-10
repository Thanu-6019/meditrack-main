import type { GuardrailResult } from "./types";

// ─── Pattern Definitions ───────────────────────────────────────────────────────

interface GuardrailPattern {
  type: "diagnosis" | "emergency" | "prescription";
  patterns: RegExp[];
  response: string;
}

const GUARDRAIL_PATTERNS: GuardrailPattern[] = [
  // ── EMERGENCY: Highest priority — check first ──────────────────────────────
  {
    type: "emergency",
    patterns: [
      /severe\s+chest\s+pain/i,
      /chest\s+pain/i,
      /can[''']t\s+breath/i,
      /cannot\s+breath/i,
      /difficulty\s+breath/i,
      /trouble\s+breath/i,
      /shortness\s+of\s+breath/i,
      /heart\s+attack/i,
      /stroke/i,
      /unconscious/i,
      /passed\s+out/i,
      /collapsed/i,
      /coughing\s+blood/i,
      /vomiting\s+blood/i,
      /severe\s+bleeding/i,
      /uncontrolled\s+bleeding/i,
      /allergic\s+reaction/i,
      /anaphylaxis/i,
      /seizure/i,
      /overdose/i,
      /suicid/i,
      /self[\s-]harm/i,
      /kill\s+(my)?self/i,
      /severe\s+abdominal\s+pain/i,
      /sudden\s+severe\s+headache/i,
      /vision\s+(loss|problem)/i,
      /sudden\s+(weakness|numbness)/i,
      /slurred\s+speech/i,
      /face\s+drooping/i,
    ],
    response:
      "⚠️ **This sounds like a medical emergency. Please call emergency services (911 or your local emergency number) immediately or go to the nearest emergency room.** Do not delay seeking help.\n\nIf someone is with you, ask them to help. If you are in immediate danger, call emergency services now.",
  },

  // ── PRESCRIPTION: Medication change requests ──────────────────────────────
  {
    type: "prescription",
    patterns: [
      /should\s+i\s+stop\s+taking/i,
      /can\s+i\s+stop\s+taking/i,
      /stop\s+taking\s+my\s+medication/i,
      /quit\s+taking/i,
      /discontinue\s+(my\s+)?(medication|medicine|drug|pill)/i,
      /should\s+i\s+(increase|decrease|reduce|lower|raise)\s+(my\s+)?(dose|dosage)/i,
      /can\s+i\s+(increase|decrease|change)\s+(my\s+)?(dose|dosage)/i,
      /double\s+(my\s+)?(dose|medication)/i,
      /take\s+more\s+(of\s+)?(my\s+)?(medication|medicine|pill)/i,
      /take\s+less\s+(of\s+)?(my\s+)?(medication|medicine|pill)/i,
      /prescribe\s+me/i,
      /give\s+me\s+a\s+prescription/i,
      /need\s+a\s+prescription\s+for/i,
      /change\s+my\s+(medication|medicine|prescription)/i,
      /switch\s+(from|to)\s+\w+\s+(medication|medicine)/i,
      /is\s+\w+\s+safe\s+to\s+take\s+with/i,
      /drug\s+interaction/i,
      /can\s+i\s+take\s+\w+\s+with\s+\w+/i,
    ],
    response:
      "I'm not able to provide advice about changing, stopping, or adjusting your medications. **Please consult your healthcare provider or pharmacist before making any changes to your medication regimen.** They have your complete medical history and are best qualified to advise you.\n\nI can help you track your current adherence, set reminders, and summarize your medication history to share with your doctor.",
  },

  // ── DIAGNOSIS: Asking for diagnosis or condition assessment ───────────────
  {
    type: "diagnosis",
    patterns: [
      /do\s+i\s+have\s+(a|an)?\s*\w+(osis|itis|emia|pathy|oma|osis)/i,
      /am\s+i\s+(sick|ill|diabetic|hypertensive|anemic)/i,
      /what\s+(disease|condition|illness)\s+do\s+i\s+have/i,
      /what\s+is\s+wrong\s+with\s+me/i,
      /diagnose\s+me/i,
      /could\s+this\s+be\s+(cancer|diabetes|hypertension|lupus|hiv)/i,
      /do\s+i\s+have\s+(diabetes|cancer|hypertension|lupus|covid)/i,
      /is\s+this\s+(symptom|reading)\s+dangerous/i,
      /what\s+does\s+(this|my)\s+(symptom|reading|result)\s+mean/i,
      /should\s+i\s+be\s+worried\s+about/i,
      /is\s+my\s+(glucose|blood\s+pressure|heart\s+rate)\s+(dangerous|bad|serious)/i,
      /normal\s+(for\s+)?(my\s+)?(age|condition)/i,
      /treatment\s+for\s+my/i,
      /cure\s+for\s+my/i,
    ],
    response:
      "I'm not able to provide medical diagnoses or interpret symptoms as a medical professional would. **Please consult your doctor or healthcare provider** for a proper evaluation.\n\nWhat I *can* do is summarize your tracked health metrics, medication adherence, and trends — information that can be very useful to share with your healthcare provider at your next appointment.",
  },
];

// ─── Sanitisation ──────────────────────────────────────────────────────────────

/**
 * Strip potentially harmful prompt-injection patterns before storage.
 * This is a lightweight defense-in-depth measure; the main guardrails
 * operate on intent patterns above.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\[INST\]|\[\/INST\]/gi, "") // Llama injection markers
    .replace(/<\|im_start\|>|<\|im_end\|>/gi, "") // ChatML markers
    .replace(/system:/gi, "System:") // Prevent role spoofing
    .replace(/assistant:/gi, "Assistant:") // Prevent role spoofing
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "")
    .replace(/ignore\s+your\s+(system\s+)?prompt/gi, "")
    .replace(/you\s+are\s+now\s+(a|an)/gi, "")
    .trim()
    .slice(0, 2000); // Hard length cap
}

// ─── Main Guardrail Check ──────────────────────────────────────────────────────

/**
 * Check a user message against all safety guardrails.
 * Returns early on first match (priority: emergency > prescription > diagnosis).
 */
export function checkGuardrails(message: string): GuardrailResult {
  const sanitized = message.toLowerCase().trim();

  for (const guardrail of GUARDRAIL_PATTERNS) {
    for (const pattern of guardrail.patterns) {
      if (pattern.test(sanitized)) {
        return {
          isSafe: false,
          type: guardrail.type,
          response: guardrail.response,
        };
      }
    }
  }

  return { isSafe: true, type: "safe" };
}

// ─── Convenience exports ───────────────────────────────────────────────────────

export type { GuardrailResult };