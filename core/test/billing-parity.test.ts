import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { verifyLicense } from "../src/license";

// The Stripe webhook's actual signing code lives in the sibling billing/ package
// (plain JS), which is private and gitignored — it is absent from public clones
// and CI. Load it dynamically so the test file still imports cleanly when it's
// missing, and skip the parity suite rather than hard-failing on a missing module.
type BillingSign = {
  signLicense: (priv: string, email: string, expiry?: string) => string;
  b64url: (s: string) => string;
};
let billing: BillingSign | null = null;
try {
  // @ts-expect-error — sign.mjs has no type declarations; resolved at runtime when present.
  billing = (await import("../../billing/sign.mjs")) as BillingSign;
} catch {
  billing = null;
}
const maybe = billing ? describe : describe.skip;

/**
 * The revenue path's highest-risk seam: the webhook signs license keys; core
 * verifies them. If their byte formats ever drift, a paying customer's key
 * silently fails to activate. These tests run the *real* webhook signing code
 * against the *real* verifier. Skipped where the private billing/ package isn't
 * checked out (public clones / CI).
 */
maybe("Stripe webhook signing ↔ core verifyLicense parity", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "pem" }) as string;
  const priv = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  it("a webhook-signed key verifies as valid Pro in core", () => {
    const { signLicense } = billing!;
    const key = signLicense(priv, "alice@example.com");
    expect(verifyLicense(key, pub)).toMatchObject({
      valid: true,
      tier: "pro",
      email: "alice@example.com",
    });
  });

  it("respects expiry: future = valid Pro, past = free", () => {
    const { signLicense } = billing!;
    expect(verifyLicense(signLicense(priv, "a@b.com", "2999-01-01"), pub).valid).toBe(true);
    expect(verifyLicense(signLicense(priv, "a@b.com", "2000-01-01"), pub)).toMatchObject({
      valid: false,
      tier: "free",
    });
  });

  it("a key signed by a DIFFERENT private key is rejected (free)", () => {
    const { signLicense } = billing!;
    const { privateKey: other } = generateKeyPairSync("ed25519");
    const otherPriv = other.export({ type: "pkcs8", format: "pem" }) as string;
    const key = signLicense(otherPriv, "a@b.com");
    expect(verifyLicense(key, pub).valid).toBe(false);
  });

  it("a tampered payload (free→pro swap) is rejected", () => {
    const { signLicense, b64url } = billing!;
    const key = signLicense(priv, "a@b.com");
    const [payloadB64, sig] = key.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    payload.email = "attacker@evil.com"; // change a trusted field, keep the old signature
    const forged = `${b64url(JSON.stringify(payload))}.${sig}`;
    expect(verifyLicense(forged, pub).valid).toBe(false);
  });
});
