export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "empty" | "weak" | "fair" | "strong" | "very-strong";
};

const COMMON_PATTERNS = [/^(password|qwerty|abc|letmein|welcome|admin|123456)/i, /^(.)\1{3,}$/];

export function scorePassword(pw: string): PasswordStrength {
  if (pw.length === 0) return { score: 0, label: "empty" };

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;

  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (variety >= 3) score++;

  if (COMMON_PATTERNS.some((re) => re.test(pw))) score = Math.max(0, score - 2);

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  const label: PasswordStrength["label"] =
    clamped === 0
      ? "weak"
      : clamped === 1
        ? "weak"
        : clamped === 2
          ? "fair"
          : clamped === 3
            ? "strong"
            : "very-strong";
  return { score: clamped, label };
}
