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

  // Long high-entropy blobs (hex / base64url tokens). Excludes `/` so ordinary
  // file paths (which are slash-delimited) are not swallowed. Run LAST.
  { re: /\b[A-Za-z0-9+_-]{40,}={0,2}\b/g, replace: PLACEHOLDER },
];

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
  return out;
}
