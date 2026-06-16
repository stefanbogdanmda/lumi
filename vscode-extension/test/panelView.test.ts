/**
 * panelView.test.ts
 *
 * Tests for the pure utilities extracted from panelView: getNonce() and
 * buildHtml().  These have no vscode import so they run fine in Node/vitest.
 */

import { describe, it, expect } from "vitest";
import { getNonce, buildHtml } from "../src/panelUtils";

// ---------------------------------------------------------------------------
// getNonce
// ---------------------------------------------------------------------------

describe("getNonce", () => {
  it("returns a string of exactly 32 characters", () => {
    expect(getNonce()).toHaveLength(32);
  });

  it("contains only alphanumeric characters", () => {
    const nonce = getNonce();
    expect(/^[A-Za-z0-9]{32}$/.test(nonce)).toBe(true);
  });

  it("returns different values on successive calls (probabilistic)", () => {
    // The probability of two 32-char alphanumeric nonces colliding is ~1/10^57.
    expect(getNonce()).not.toBe(getNonce());
  });
});

// ---------------------------------------------------------------------------
// buildHtml
// ---------------------------------------------------------------------------

const TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src __CSP_SOURCE__ 'nonce-__NONCE__'; script-src 'nonce-__NONCE__'">
  <link rel="stylesheet" href="__CSS__">
</head>
<body>
  <script nonce="__NONCE__" src="__JS__"></script>
</body>
</html>`;

describe("buildHtml", () => {
  it("substitutes __CSS__ with the provided cssUri", () => {
    const result = buildHtml(TEMPLATE, "https://css-uri", "https://js-uri", "vscode-webview:", "TESTNONCE");
    expect(result).toContain("https://css-uri");
    expect(result).not.toContain("__CSS__");
  });

  it("substitutes __JS__ with the provided jsUri", () => {
    const result = buildHtml(TEMPLATE, "https://css-uri", "https://js-uri", "vscode-webview:", "TESTNONCE");
    expect(result).toContain("https://js-uri");
    expect(result).not.toContain("__JS__");
  });

  it("substitutes __CSP_SOURCE__ with the provided cspSource", () => {
    const result = buildHtml(TEMPLATE, "https://css-uri", "https://js-uri", "vscode-webview:", "TESTNONCE");
    expect(result).toContain("vscode-webview:");
    expect(result).not.toContain("__CSP_SOURCE__");
  });

  it("replaces ALL occurrences of __NONCE__ with the nonce (global replace)", () => {
    const result = buildHtml(TEMPLATE, "https://css-uri", "https://js-uri", "vscode-webview:", "MYNONCE");
    // __NONCE__ appears 3 times in TEMPLATE; all must be replaced.
    expect(result).not.toContain("__NONCE__");
    const count = (result.match(/MYNONCE/g) ?? []).length;
    expect(count).toBe(3);
  });

  it("returns the raw template unchanged except for substitutions", () => {
    const raw = "hello __CSS__ world __NONCE__ foo __NONCE__ bar __JS__ baz __CSP_SOURCE__";
    const result = buildHtml(raw, "CSS", "JS", "CSP", "NONCE");
    expect(result).toBe("hello CSS world NONCE foo NONCE bar JS baz CSP");
  });
});
