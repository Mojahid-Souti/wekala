/**
 * Lightweight client-side security pre-scan for pasted YAML.
 *
 * This is NOT a replacement for the server-side gatekeeper (Phase 6 — full
 * Presidio + injection detection + classification policy). It's a fast
 * heuristic mirror that surfaces obvious red flags inline in the editor
 * before the user even submits. The authoritative scan still runs on
 * import and the agent stays in Draft until that pass completes.
 */

export type ScanSeverity = "critical" | "high" | "medium" | "low";

export type ScanFinding = {
  id: string;
  severity: ScanSeverity;
  type: string;
  line: number;
  snippet: string;
  message: string;
};

type Rule = {
  id: string;
  type: string;
  severity: ScanSeverity;
  pattern: RegExp;
  message: string;
};

const RULES: Rule[] = [
  // ---- PII patterns (Omani-leaning, but generic enough to catch most) ----
  {
    id: "pii.iban",
    type: "PII / IBAN",
    severity: "critical",
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,20}\b/g,
    message: "Looks like an IBAN. Never embed real bank details in agent definitions.",
  },
  {
    id: "pii.oman_id",
    type: "PII / National ID (Oman)",
    severity: "critical",
    pattern: /\b\d{8}\b/g,
    message:
      "8-digit number looks like an Oman national ID. Confirm this is example data, not a real identifier.",
  },
  {
    id: "pii.email",
    type: "PII / email",
    severity: "medium",
    pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
    message: "Real email addresses inside prompts get logged and shared across runs.",
  },
  {
    id: "pii.oman_mobile",
    type: "PII / mobile (Oman)",
    severity: "high",
    pattern: /(?:\+?968[\s-]?)?(?:9\d{3}[\s-]?\d{4})/g,
    message: "Looks like an Oman mobile number.",
  },
  // ---- Prompt-injection patterns ----
  {
    id: "injection.instruction_override",
    type: "Prompt injection",
    severity: "critical",
    pattern: /ignore\s+(?:all\s+|the\s+|previous\s+|prior\s+)?(?:instructions?|rules?|prompts?)/gi,
    message: 'Classic "ignore previous instructions" attack. Strip it before saving.',
  },
  {
    id: "injection.role_override",
    type: "Prompt injection",
    severity: "high",
    pattern: /you\s+are\s+(?:now|actually)\s+(?:an?\s+)?(?:admin|root|developer|system)/gi,
    message: "Role-escalation attempt.",
  },
  {
    id: "injection.system_leak",
    type: "Prompt injection",
    severity: "high",
    pattern:
      /(?:print|reveal|show|repeat)\s+(?:the\s+|your\s+)?(?:system\s+prompt|hidden\s+prompt|secret)/gi,
    message: "System-prompt leak request.",
  },
  // ---- Secret patterns ----
  {
    id: "secret.api_key_generic",
    type: "Secret / API key",
    severity: "critical",
    pattern: /(?:sk|pk|api[_-]?key)[_-]?[a-z0-9]{16,}/gi,
    message: "Looks like an API key. Move secrets to a credentials provider, never inline.",
  },
];

/**
 * Run every rule against the input and return one finding per match.
 * Complexity: O(n × r) over input length n and rule count r. Fine for ≤1MB.
 */
export function scanYaml(input: string): ScanFinding[] {
  if (!input) return [];
  const findings: ScanFinding[] = [];
  const lines = input.split("\n");

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let safety = 0;
    let match = re.exec(input);
    while (match !== null) {
      if (safety++ > 200) break; // defend against pathological inputs
      const upTo = input.slice(0, match.index);
      const lineIdx = upTo.split("\n").length - 1;
      const lineText = lines[lineIdx] ?? "";
      findings.push({
        id: `${rule.id}:${match.index}`,
        severity: rule.severity,
        type: rule.type,
        line: lineIdx + 1,
        snippet: lineText.trim().slice(0, 120),
        message: rule.message,
      });
      // Prevent zero-length-match infinite loops.
      if (match.index === re.lastIndex) re.lastIndex += 1;
      match = re.exec(input);
    }
  }

  // Sort by severity rank then line.
  const rank: Record<ScanSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.line - b.line);
  return findings;
}
