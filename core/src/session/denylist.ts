/**
 * Commands/contexts whose records must be DROPPED entirely (not just redacted),
 * because their output routinely contains raw secrets. Bias to drop on doubt.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  /^env\b/,                              // env / printenv dump
  /^printenv\b/,
  /\b(?:cat|type|less|more|bat)\b[^\n]*\.env\b/, // reading a .env file
  /\bid_(?:rsa|ed25519|ecdsa|dsa)\b/,    // private SSH keys
  /\.pem\b/,                             // PEM material
  /\bopenssl\b/,
  /\bgpg\b[^\n]*(?:--export-secret|secret-key)/,
  /\bvault\b\s+(?:read|kv)\b/,
  /\bop\b\s+(?:item|read)\b/,            // 1Password CLI
  /\bssh-keygen\b/,
  /\.npmrc\b/,
  /\.git-credentials\b/,
  /\bkubeconfig\b/,
  /^sudo\b/,                             // likely a password prompt
  /^ssh\b\s+\S+@/,                       // interactive ssh login
];

/** True if this command's record should be dropped before any capture. */
export function isSensitiveCommand(command: string): boolean {
  const c = command.trim().toLowerCase();
  if (!c) return false;
  return SENSITIVE_PATTERNS.some((re) => re.test(c));
}
