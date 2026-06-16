import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import {
  verifyLicense,
  JsonFileLicenseStore,
  currentEntitlement,
} from "../src/license";
import type { LicenseResult } from "../src/license";

// ---------------------------------------------------------------------------
// Helpers: generate a fresh Ed25519 keypair for each test run
// ---------------------------------------------------------------------------

function makeTestKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey: publicKey as string, privateKey: privateKey as string };
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function makeKey(
  payload: object,
  privateKeyPem: string
): string {
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  // Ed25519 uses the one-shot sign(null, data, key) API — no separate hash step
  const sigBuffer = cryptoSign(null, Buffer.from(payloadB64, "utf8"), privateKeyPem);
  const sigB64 = sigBuffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${payloadB64}.${sigB64}`;
}

// ---------------------------------------------------------------------------
// verifyLicense
// ---------------------------------------------------------------------------

describe("verifyLicense", () => {
  let pub: string;
  let priv: string;

  beforeEach(() => {
    const kp = makeTestKeypair();
    pub = kp.publicKey;
    priv = kp.privateKey;
  });

  it("returns valid:true / tier:pro for a correctly signed, non-expired key", () => {
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
    };
    const key = makeKey(payload, priv);
    const result = verifyLicense(key, pub);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.email).toBe("user@example.com");
    expect(result.reason).toBeUndefined();
  });

  it("returns valid:true for a key with a future expiry", () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
      expires: future,
    };
    const key = makeKey(payload, priv);
    const result = verifyLicense(key, pub);
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.expires).toBe(future);
  });

  it("returns valid:false / tier:free for an expired key", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
      expires: past,
    };
    const key = makeKey(payload, priv);
    const result = verifyLicense(key, pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toMatch(/expir/i);
  });

  it("returns valid:false / tier:free for a tampered payload", () => {
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
    };
    const key = makeKey(payload, priv);
    // Tamper: replace the payload portion with a different email
    const [, sig] = key.split(".");
    const tamperedPayload = b64urlEncode(
      JSON.stringify({ ...payload, email: "hacker@evil.com" })
    );
    const tampered = `${tamperedPayload}.${sig}`;
    const result = verifyLicense(tampered, pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toBeTruthy();
  });

  it("returns valid:false / tier:free for a tampered signature", () => {
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
    };
    const key = makeKey(payload, priv);
    const [payloadPart] = key.split(".");
    const tampered = `${payloadPart}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const result = verifyLicense(tampered, pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toBeTruthy();
  });

  it("returns valid:false / tier:free for an empty string", () => {
    const result = verifyLicense("", pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toBeTruthy();
  });

  it("returns valid:false / tier:free for garbage input", () => {
    const result = verifyLicense("not-a-real-license-key!!!", pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toBeTruthy();
  });

  it("returns valid:false / tier:free when signed by a different private key", () => {
    const otherKp = makeTestKeypair();
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
    };
    // Sign with a different private key, verify with the original public key
    const key = makeKey(payload, otherKp.privateKey);
    const result = verifyLicense(key, pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toBeTruthy();
  });

  it("allows custom `now` override to test expiry boundary (still valid just before expiry)", () => {
    const expires = new Date("2025-01-01T00:00:00.000Z").toISOString();
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: "2024-01-01T00:00:00.000Z",
      expires,
    };
    const key = makeKey(payload, priv);
    // now = 1 second before expiry → valid
    const result = verifyLicense(key, pub, new Date("2024-12-31T23:59:59.000Z"));
    expect(result.valid).toBe(true);
  });

  it("allows custom `now` override: expired at exactly now", () => {
    const expires = new Date("2025-01-01T00:00:00.000Z").toISOString();
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: "2024-01-01T00:00:00.000Z",
      expires,
    };
    const key = makeKey(payload, priv);
    // now = exactly the expiry time → expired
    const result = verifyLicense(key, pub, new Date("2025-01-01T00:00:00.000Z"));
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
  });

  // ---------------------------------------------------------------------------
  // FIX 4 regression: non-date expires string must be treated as expired
  // ---------------------------------------------------------------------------

  it("FIX 4: key with expires:'banana' is treated as expired (free), not never-expiring", () => {
    // new Date("banana").getTime() === NaN; NaN comparison is always false,
    // so the old code would never-expire such a key. The fix checks isNaN.
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
      expires: "banana",
    };
    const key = makeKey(payload, priv);
    const result = verifyLicense(key, pub);
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
    expect(result.reason).toMatch(/expir/i);
  });
});

// ---------------------------------------------------------------------------
// JsonFileLicenseStore
// ---------------------------------------------------------------------------

describe("JsonFileLicenseStore", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "lumi-license-"));
    filePath = join(tmpDir, "license.json");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("getKey() returns undefined when the file does not exist", () => {
    const store = new JsonFileLicenseStore(filePath);
    expect(store.getKey()).toBeUndefined();
  });

  it("setKey / getKey round-trips the key string", () => {
    const store = new JsonFileLicenseStore(filePath);
    store.setKey("some-license-key-value");
    expect(store.getKey()).toBe("some-license-key-value");
  });

  it("persists across two instances pointing at the same file", () => {
    const store1 = new JsonFileLicenseStore(filePath);
    store1.setKey("key-abc-123");
    const store2 = new JsonFileLicenseStore(filePath);
    expect(store2.getKey()).toBe("key-abc-123");
  });

  it("tolerates a missing file gracefully (no throw)", () => {
    const store = new JsonFileLicenseStore(join(tmpDir, "does-not-exist.json"));
    expect(() => store.getKey()).not.toThrow();
  });

  it("tolerates a corrupt JSON file (returns undefined without throwing)", () => {
    writeFileSync(filePath, "NOT VALID JSON!!!", "utf8");
    const store = new JsonFileLicenseStore(filePath);
    expect(store.getKey()).toBeUndefined();
  });

  it("tolerates a file with unexpected JSON shape (returns undefined)", () => {
    writeFileSync(filePath, JSON.stringify({ wrong: "shape" }), "utf8");
    const store = new JsonFileLicenseStore(filePath);
    expect(store.getKey()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// currentEntitlement
// ---------------------------------------------------------------------------

describe("currentEntitlement", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "lumi-home-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns free when no license file exists", () => {
    const result = currentEntitlement({ home: tmpDir });
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
  });

  it("returns pro when a valid license key is stored", () => {
    const { publicKey, privateKey } = makeTestKeypair();
    const payload = {
      email: "user@example.com",
      tier: "pro",
      issued: new Date().toISOString(),
    };
    const key = makeKey(payload, privateKey);
    // Store it
    const licenseFile = join(tmpDir, "license.json");
    const store = new JsonFileLicenseStore(licenseFile);
    store.setKey(key);

    const result = currentEntitlement({
      home: tmpDir,
      publicKeyPem: publicKey,
    });
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("pro");
  });

  it("returns free when stored key is corrupted", () => {
    const licenseFile = join(tmpDir, "license.json");
    writeFileSync(licenseFile, JSON.stringify({ key: "garbage!!!" }), "utf8");
    const { publicKey } = makeTestKeypair();
    const result = currentEntitlement({ home: tmpDir, publicKeyPem: publicKey });
    expect(result.valid).toBe(false);
    expect(result.tier).toBe("free");
  });
});
