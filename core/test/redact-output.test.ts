import { describe, it, expect } from "vitest";
import { redactSecrets } from "../src/redact";

const R = "[REDACTED]";

describe("redactSecrets — free-form output hardening", () => {
  it("collapses a multi-line PEM private key block", () => {
    const key =
      "-----BEGIN RSA PRIVATE KEY-----\n" +
      "MIIEpAIBAAKCAQEA" + "x".repeat(40) + "\n" +
      "abcd" + "y".repeat(40) + "\n" +
      "-----END RSA PRIVATE KEY-----";
    const out = redactSecrets("here is the key:\n" + key + "\ndone");
    expect(out).toContain(R);
    expect(out).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(out).toContain("done");
  });

  it("redacts an arbitrary UPPER_SNAKE=token from an env-style line", () => {
    const secret = "SUPER_TOKEN=" + "A1b2C3d4" + "E5f6G7h8" + "I9j0K1l2";
    const out = redactSecrets("DEBUG=true\n" + secret + "\nPORT=3000");
    expect(out).toContain("DEBUG=true");
    expect(out).toContain("PORT=3000");
    expect(out).not.toContain("A1b2C3d4E5f6G7h8I9j0K1l2");
  });

  it("redacts a high-entropy base64 blob that contains a slash", () => {
    const blob = "wJalrXUtnFEMI/K7MDENG/bPxRfiCY" + "EXAMPLEKEY1234567890 abc";
    const out = redactSecrets("aws_secret = " + blob);
    expect(out).toContain(R);
  });

  it("preserves ordinary slash-bearing file paths", () => {
    const out = redactSecrets("wrote C:/Users/devuser/projects/lumi/core/src/server.ts");
    expect(out).toContain("server.ts");
    expect(out).not.toContain(R);
  });

  it("redacts PII: email and a card-like number", () => {
    const out = redactSecrets("contact a.user@example.com card 4242 4242 4242 4242 end");
    expect(out).not.toContain("a.user@example.com");
    expect(out).not.toContain("4242 4242 4242 4242");
    expect(out).toContain("end");
  });

  it("does not hang on many unterminated BEGIN markers (ReDoS guard)", () => {
    const evil = "-----BEGIN PRIVATE KEY-----\n".repeat(16000); // no END markers
    const start = Date.now();
    redactSecrets(evil);
    expect(Date.now() - start).toBeLessThan(500); // ms
  });

  it("still redacts a real CERTIFICATE block", () => {
    const cert =
      "-----BEGIN CERTIFICATE-----\n" +
      "MIIB" + "z".repeat(60) + "\n" +
      "-----END CERTIFICATE-----";
    const out = redactSecrets("cert:\n" + cert + "\nok");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("BEGIN CERTIFICATE");
    expect(out).toContain("ok");
  });
});
