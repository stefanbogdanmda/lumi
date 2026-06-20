import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verify as cryptoVerify } from "node:crypto";
import { atomicWriteFileSync } from "./fsutil";
import { lumiHome } from "./paths";

// ---------------------------------------------------------------------------
// Embedded license public key (Ed25519).
// Pro license keys are signed offline with the matching private key (kept out
// of this repo) and verified against this public key. Any missing, malformed,
// forged, or expired key is caught below and safely treated as the free tier.
// Regenerate with: node core/scripts/make-license-keypair.mjs
// ---------------------------------------------------------------------------
const LUMI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAcStxMQBGVVfbYCu1elMuOakHczoJMeQlHRN24tBk3Os=
-----END PUBLIC KEY-----`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LicenseResult {
  valid: boolean;
  tier: "free" | "pro";
  email?: string;
  expires?: string;
  reason?: string;
}

interface LicensePayload {
  email: string;
  tier: "pro";
  issued: string;
  expires?: string;
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

function b64urlDecode(s: string): Buffer {
  // Restore standard base64 padding
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padding), "base64");
}

// ---------------------------------------------------------------------------
// verifyLicense
// ---------------------------------------------------------------------------

/**
 * Verify an Ed25519-signed license key.
 *
 * @param key        The license key string: `<base64url-payload>.<base64url-sig>`
 * @param publicKeyPem  PEM-encoded Ed25519 public key (defaults to embedded LUMI_PUBLIC_KEY).
 * @param now        Override current time for testing expiry; defaults to `new Date()`.
 */
export function verifyLicense(
  key: string,
  publicKeyPem?: string,
  now?: Date
): LicenseResult {
  const FREE: LicenseResult = { valid: false, tier: "free" };

  if (!key || typeof key !== "string") {
    return { ...FREE, reason: "Empty or invalid key" };
  }

  const dotIdx = key.indexOf(".");
  if (dotIdx === -1) {
    return { ...FREE, reason: "Malformed key: missing separator" };
  }

  const payloadB64 = key.slice(0, dotIdx);
  const sigB64 = key.slice(dotIdx + 1);

  if (!payloadB64 || !sigB64) {
    return { ...FREE, reason: "Malformed key: empty payload or signature" };
  }

  // Decode payload
  let payload: LicensePayload;
  try {
    const payloadJson = b64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(payloadJson) as LicensePayload;
  } catch {
    return { ...FREE, reason: "Malformed key: cannot decode payload" };
  }

  // Validate payload shape
  if (!payload || typeof payload.email !== "string" || payload.tier !== "pro") {
    return { ...FREE, reason: "Malformed key: invalid payload fields" };
  }

  // Verify signature
  const pemKey = publicKeyPem ?? LUMI_PUBLIC_KEY;
  let sigBuffer: Buffer;
  try {
    sigBuffer = b64urlDecode(sigB64);
  } catch {
    return { ...FREE, reason: "Malformed key: cannot decode signature" };
  }

  try {
    // Ed25519 uses the one-shot verify(null, data, key, sig) API — no separate hash step
    const ok = cryptoVerify(null, Buffer.from(payloadB64, "utf8"), pemKey, sigBuffer);
    if (!ok) {
      return { ...FREE, reason: "Invalid signature" };
    }
  } catch {
    return { ...FREE, reason: "Signature verification failed" };
  }

  // Check expiry — also treat a non-parseable expires string as expired (NaN guard).
  // new Date("banana").getTime() === NaN, and (now >= NaN) is false, so without the NaN
  // check a malformed expires string would be silently treated as "never expires".
  if (payload.expires) {
    const expiryTime = new Date(payload.expires).getTime();
    const nowTime = (now ?? new Date()).getTime();
    if (Number.isNaN(expiryTime) || nowTime >= expiryTime) {
      return { ...FREE, reason: "License has expired", expires: payload.expires };
    }
  }

  return {
    valid: true,
    tier: "pro",
    email: payload.email,
    ...(payload.expires ? { expires: payload.expires } : {}),
  };
}

// ---------------------------------------------------------------------------
// JsonFileLicenseStore
// ---------------------------------------------------------------------------

interface LicenseFile {
  key: string;
}

/** Persist the activated license key string to a JSON file (mirrors JsonFileProfile). */
export class JsonFileLicenseStore {
  private cached: string | undefined;
  private loaded = false;

  constructor(private file: string) {}

  getKey(): string | undefined {
    if (!this.loaded) {
      this.cached = this.loadFromDisk();
      this.loaded = true;
    }
    return this.cached;
  }

  setKey(key: string): void {
    const data: LicenseFile = { key };
    atomicWriteFileSync(this.file, JSON.stringify(data, null, 2));
    this.cached = key;
    this.loaded = true;
  }

  private loadFromDisk(): string | undefined {
    if (!existsSync(this.file)) return undefined;
    try {
      const raw = readFileSync(this.file, "utf8");
      const data = JSON.parse(raw) as Partial<LicenseFile>;
      if (typeof data.key === "string") return data.key;
      return undefined;
    } catch {
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// currentEntitlement
// ---------------------------------------------------------------------------

export interface CurrentEntitlementOpts {
  /** Override the Lumi home directory (used for tests). Defaults to lumiHome(). */
  home?: string;
  /** Override the public key PEM (used for tests). Defaults to LUMI_PUBLIC_KEY. */
  publicKeyPem?: string;
  /** Override current time (used for testing expiry). Defaults to new Date(). */
  now?: Date;
}

/** Read the stored license key (if any) and verify it. Returns free when absent or invalid. */
export function currentEntitlement(opts?: CurrentEntitlementOpts): LicenseResult {
  const home = opts?.home ?? lumiHome();
  const licenseFile = join(home, "license.json");
  const store = new JsonFileLicenseStore(licenseFile);
  const key = store.getKey();
  if (!key) {
    return { valid: false, tier: "free", reason: "No license key stored" };
  }
  return verifyLicense(key, opts?.publicKeyPem, opts?.now);
}
