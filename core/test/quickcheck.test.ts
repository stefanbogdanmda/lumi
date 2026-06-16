import { describe, it, expect } from "vitest";
import { quickCheckPrompt } from "../src/quickcheck";

describe("quickCheckPrompt", () => {
  it("returns a non-empty string for a normal label", () => {
    const result = quickCheckPrompt("git rebase");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains the label inside the prompt", () => {
    const label = "Docker layer";
    const result = quickCheckPrompt(label);
    expect(result).toContain(label);
  });

  it("contains an invitation to guess before revealing", () => {
    const result = quickCheckPrompt("closure");
    // The word "guess" or "reveal" signals the active-recall intent
    expect(result.toLowerCase()).toMatch(/guess|reveal/);
  });

  it("is stable — same label always produces same output", () => {
    const label = "async/await";
    expect(quickCheckPrompt(label)).toBe(quickCheckPrompt(label));
  });

  it("includes the label even when it contains special characters", () => {
    const label = 'HTTP "status" codes & methods';
    const result = quickCheckPrompt(label);
    expect(result).toContain(label);
  });

  it("returns the exact expected sentence for a known label", () => {
    expect(quickCheckPrompt("git commit")).toBe(
      'Before the answer — what do you think "git commit" means? Take a guess, then reveal.'
    );
  });
});
