import { describe, it, expect } from "vitest";
import { redactSecrets } from "../src/redact";

const R = "[REDACTED]";

describe("redactSecrets — Phase 2 top-up", () => {
  it("collapses a PGP private-key block (label has a trailing word)", () => {
    const block =
      "-----BEGIN PGP PRIVATE KEY BLOCK-----\n" +
      "lQOYBF" + "a".repeat(50) + "\n" +
      "=AbCd\n" +
      "-----END PGP PRIVATE KEY BLOCK-----";
    const out = redactSecrets("key:\n" + block + "\nbye");
    expect(out).toContain(R);
    expect(out).not.toContain("PGP PRIVATE KEY BLOCK");
    expect(out).toContain("bye");
  });

  it("redacts a Luhn-valid card and preserves a non-Luhn 16-digit run", () => {
    const out = redactSecrets("card 4242 4242 4242 4242 order 1234567812345670 x");
    expect(out).not.toContain("4242 4242 4242 4242");
    expect(out).toContain("x");
    expect(redactSecrets("id 1111111111111112")).toContain("1111111111111112");
  });

  it("redacts phone numbers (US and international forms)", () => {
    expect(redactSecrets("call +1 (415) 555-0132 now")).not.toContain("555-0132");
    expect(redactSecrets("ring +44 20 7946 0958 ok")).not.toContain("7946 0958");
  });

  it("redacts an IBAN", () => {
    const iban = "DE89" + "3704004405320130" + "00";
    expect(redactSecrets("pay to " + iban + " please")).not.toContain(iban);
  });

  it("redacts IPv4 and IPv6 addresses", () => {
    expect(redactSecrets("host 203.0.113.42 down")).not.toContain("203.0.113.42");
    expect(redactSecrets("v6 2001:db8::8a2e:370:7334 up")).not.toContain("2001:db8::8a2e:370:7334");
  });

  it("does not over-redact ordinary version numbers or short digit runs", () => {
    expect(redactSecrets("upgraded to 1.2.3 and port 8080")).toContain("1.2.3");
    expect(redactSecrets("upgraded to 1.2.3 and port 8080")).toContain("8080");
  });

  it("still redacts a Luhn-valid 16-digit unspaced PAN", () => {
    expect(redactSecrets("pan 4111111111111111 end")).not.toContain("4111111111111111");
  });
});
