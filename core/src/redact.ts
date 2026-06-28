/**
 * redact.ts — strip secrets from free text before it is detected, logged, or
 * written to the feed. Conservative by design: redact obvious credentials, but
 * avoid mangling ordinary commands, prose, and file paths.
 *
 * `redactSecrets` runs a fixed, ordered list of patterns. Order matters:
 * specific provider tokens and connection strings run before the generic
 * "long high-entropy blob" rule so structured secrets keep a readable shape.
 */

const PLACEHOLDER = "[REDACTED]";

/** One redaction rule: a global regex and the replacement to apply. */
interface Rule {
  re: RegExp;
  replace: string;
}

// NOTE: every `re` MUST be global (`g`) so String.replace swaps all matches.
const RULES: Rule[] = [
  // Multi-line private-key / certificate blocks: collapse the whole armored body.
  // ReDoS-hardened three ways against attacker-influenceable stdout:
  //   1. label classes are bounded ({0,40});
  //   2. the body is length-capped ({0,8000}?) — a real PEM/cert body fits well
  //      under this;
  //   3. the body is *tempered* — `(?!-----(?:BEGIN|END))` forbids it from
  //      spanning the next armor marker. Without (3), output full of
  //      unterminated `-----BEGIN …-----` markers makes every BEGIN scan up to
  //      8000 chars forward looking for an END that never comes (~1s on a 450KB
  //      input); tempering makes each dead BEGIN fail after a single char, so
  //      the rule stays linear with a tiny constant. A legitimate PEM body never
  //      contains another armor line, so coverage (incl. encrypted DEK-Info
  //      keys) is unaffected.
  {
    re: /-----BEGIN [A-Z0-9 ]{0,40}(?:PRIVATE KEY|CERTIFICATE)-----(?:(?!-----(?:BEGIN|END))[\s\S]){0,8000}?-----END [A-Z0-9 ]{0,40}(?:PRIVATE KEY|CERTIFICATE)-----/g,
    replace: PLACEHOLDER,
  },

  // Multi-line PGP private-key blocks. Their armor label ends in " BLOCK", which
  // the PEM/cert rule above does not cover. Same ReDoS tempering as that rule.
  // BEGIN/END types are matched independently on purpose (keeps the pattern
  // simple; a mismatched pair only ever over-redacts).
  {
    re: /-----BEGIN PGP (?:PRIVATE KEY|MESSAGE)[A-Z0-9 ]{0,20}-----(?:(?!-----(?:BEGIN|END))[\s\S]){0,8000}?-----END PGP (?:PRIVATE KEY|MESSAGE)[A-Z0-9 ]{0,20}-----/g,
    replace: PLACEHOLDER,
  },

  // JWTs: header.payload.signature, each a base64url segment. Run first so the
  // generic blob rule doesn't eat half of it.
  { re: /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, replace: PLACEHOLDER },

  // OpenAI keys: sk-… and sk-proj-… (>= 16 trailing token chars).
  { re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}/g, replace: PLACEHOLDER },

  // Stripe keys: sk_live_/sk_test_/rk_live_/pk_live_ + 24+ alphanumerics.
  { re: /\b(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{24,}/g, replace: PLACEHOLDER },

  // Google API keys: AIza + 35 chars.
  { re: /\bAIza[0-9A-Za-z_-]{35}/g, replace: PLACEHOLDER },

  // GitLab personal access tokens: glpat- + 20+ chars.
  { re: /\bglpat-[0-9A-Za-z_-]{20,}/g, replace: PLACEHOLDER },

  // GitHub fine-grained PAT.
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}/g, replace: PLACEHOLDER },

  // GitHub classic tokens: ghp_, gho_, ghs_, ghu_, ghr_.
  { re: /\bgh[opsur]_[A-Za-z0-9]{20,}/g, replace: PLACEHOLDER },

  // AWS access key id.
  { re: /\bAKIA[0-9A-Z]{16}\b/g, replace: PLACEHOLDER },

  // Slack tokens: xoxb-/xoxa-/xoxp-/xoxr-/xoxs-…
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, replace: PLACEHOLDER },

  // Bearer <token> — keep the scheme word, drop the credential. Case-insensitive
  // so a lowercase `bearer …` header value is redacted too.
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, replace: `Bearer ${PLACEHOLDER}` },

  // Database / message-broker connection strings carrying credentials.
  { re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/\S+/gi, replace: PLACEHOLDER },

  // HTTP(S) URLs carrying basic-auth credentials (user:pass@host). Redact the
  // whole URL. MUST run before the generic long-blob rule so it wins.
  { re: /\bhttps?:\/\/[^\s/@]+:[^\s/@]+@\S+/gi, replace: PLACEHOLDER },

  // key = value / key: value for sensitive key names. Keep the key + separator
  // so the line stays readable; only the value is removed.
  {
    re: /(password|passwd|pwd|pass|token|secret|api[-_]?key|private[-_]?key|access[-_]?key|client[-_]?secret)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi,
    replace: `$1$2${PLACEHOLDER}`,
  },

  // Arbitrary NAME=token in output/env dumps: any UPPER_SNAKE name assigned a
  // long-ish opaque value. Keep the name + '='; drop the value.
  {
    re: /\b([A-Z][A-Z0-9_]{2,})=("[^"]*"|'[^']*'|[A-Za-z0-9+/_=-]{12,})/g,
    replace: `$1=${PLACEHOLDER}`,
  },

  // PII — email addresses.
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: PLACEHOLDER },

  // PII — IBAN: 2 country letters, 2 check digits, up to 30 alphanumerics.
  { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, replace: PLACEHOLDER },

  // PII — phone numbers: optional +, country/area groups, 7+ digits total with
  // separators. Conservative leading boundary so it won't eat version strings.
  { re: /(?<![\w.])\+?\d{1,3}[ .-]?(?:\(\d{1,4}\)[ .-]?)?\d{2,4}[ .-]\d{2,4}[ .-]?\d{2,4}\b/g, replace: PLACEHOLDER },

  // PII — IPv4 dotted quad.
  { re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, replace: PLACEHOLDER },

  // PII — IPv6 (incl. :: compression). Requires at least one ':' run of hex groups.
  // Known limitation: leading-`::` addresses (e.g. `::1`, `::ffff:…`) are not
  // matched by design — acceptable under the over-redact-on-output bias.
  { re: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{0,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b/g, replace: PLACEHOLDER },

  // Long high-entropy blobs (hex / base64, incl. '/'-bearing AWS secret keys).
  // Skip path-like strings (drive-letter or dotted segments) so file paths and
  // dotted names survive; gate on length as a cheap entropy proxy. Run LAST.
  {
    re: /(?<![\w./\\:-])[A-Za-z0-9+/_=-]{40,}={0,2}(?![\w./\\-])/g,
    replace: PLACEHOLDER,
  },
];

/** Sum-of-digits Luhn check used to distinguish real PANs from arbitrary digit runs. */
function isLuhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/**
 * Replace any recognized secret in `text` with `[REDACTED]`.
 * Pure and side-effect free; returns a new string.
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, replace } of RULES) {
    out = out.replace(re, replace);
  }
  // Card numbers: 13–19 digit groups, but only redact when Luhn-valid so order
  // ids and other long digit runs survive. Runs after the regex rules.
  out = out.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
    const digits = m.replace(/[ -]/g, "");
    return digits.length >= 13 && digits.length <= 19 && isLuhnValid(digits) ? PLACEHOLDER : m;
  });
  return out;
}
