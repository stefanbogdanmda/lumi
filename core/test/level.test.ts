import { describe, it, expect } from "vitest";
import { levelFromCount } from "../src/level";

describe("levelFromCount", () => {
  it("maps learned-count to a level", () => {
    expect(levelFromCount(0)).toBe("beginner");
    expect(levelFromCount(5)).toBe("beginner");
    expect(levelFromCount(6)).toBe("growing");
    expect(levelFromCount(20)).toBe("growing");
    expect(levelFromCount(21)).toBe("confident");
  });
});
