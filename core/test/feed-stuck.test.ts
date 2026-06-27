import { describe, it, expect } from "vitest";
import { stuckEvent } from "../src/feed";

describe("stuckEvent", () => {
  it("builds a versioned stuck event with advice", () => {
    const e = stuckEvent({ source: "claude-code", advice: "Step back…", repeatedError: "TypeError: x" });
    expect(e.type).toBe("stuck");
    expect(e.source).toBe("claude-code");
    expect(e.stuck?.advice).toBe("Step back…");
    expect(e.stuck?.repeatedError).toBe("TypeError: x");
    expect(e.v).toBe(1);
    expect(typeof e.id).toBe("string");
  });
});
