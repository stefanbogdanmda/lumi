// sign.mjs — Lumi Pro license signing (extracted so it's unit-testable).
//
// Pure: takes the private key as an argument (no env, no Stripe). The webhook
// imports this; a core test imports it too and proves a key it produces verifies
// against core/src/license.ts's verifyLicense (byte-for-byte format parity).

import { sign as edSign } from "node:crypto";

/** base64url-encode a Buffer/string (no padding). Matches license.ts's decoder. */
export function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Produce a Lumi Pro license key.
 * @param {string} privateKeyPem  Ed25519 private key PEM (incl. BEGIN/END lines).
 * @param {string} email          customer email (the license is tied to it).
 * @param {string} [expires]      optional ISO date after which the key stops working.
 * @param {Date}   [now]          override "issued" time (tests).
 * @returns {string} `<base64url-payload>.<base64url-signature>`
 */
export function signLicense(privateKeyPem, email, expires, now = new Date()) {
  if (!privateKeyPem) throw new Error("private key PEM required");
  const payload = {
    email,
    tier: "pro",
    issued: now.toISOString(),
    ...(expires ? { expires: new Date(expires).toISOString() } : {}),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  // Ed25519 one-shot sign over the base64url payload STRING bytes (matches verifyLicense).
  const sigB64 = b64url(edSign(null, Buffer.from(payloadB64, "utf8"), privateKeyPem));
  return `${payloadB64}.${sigB64}`;
}
