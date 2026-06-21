import { describe, it, expect } from "vitest";
import { welcomeMessage, milestoneFor, progressMessage, nextMilestone } from "../src/milestones";

describe("welcomeMessage", () => {
  it("returns a non-empty string", () => {
    expect(welcomeMessage().length).toBeGreaterThan(0);
  });
});

describe("milestoneFor", () => {
  it("returns a message at milestone counts", () => {
    expect(milestoneFor(1)).not.toBeNull();
    expect(milestoneFor(5)).not.toBeNull();
    expect(milestoneFor(15)).not.toBeNull();
    expect(milestoneFor(30)).not.toBeNull();
  });

  it("returns null at non-milestone counts", () => {
    expect(milestoneFor(0)).toBeNull();
    expect(milestoneFor(2)).toBeNull();
    expect(milestoneFor(6)).toBeNull();
    expect(milestoneFor(16)).toBeNull();
    expect(milestoneFor(31)).toBeNull();
  });

  it("milestone at 5 mentions Growing level", () => {
    expect(milestoneFor(5)).toContain("Growing");
  });

  it("milestone at 30 mentions Confident level", () => {
    expect(milestoneFor(30)).toContain("Confident");
  });
});

describe("nextMilestone", () => {
  it("points a fresh learner at their first milestone", () => {
    const nm = nextMilestone(0)!;
    expect(nm.target).toBe(1);
    expect(nm.remaining).toBe(1);
  });

  it("counts down toward the next celebration target", () => {
    expect(nextMilestone(3)).toMatchObject({ target: 5, remaining: 2 });
    expect(nextMilestone(10)).toMatchObject({ target: 15, remaining: 5 });
    expect(nextMilestone(29)).toMatchObject({ target: 30, remaining: 1 });
  });

  it("targets always match milestoneFor's celebration counts", () => {
    for (const count of [0, 1, 4, 5, 14, 29]) {
      const nm = nextMilestone(count)!;
      expect(milestoneFor(nm.target)).not.toBeNull();
    }
  });

  it("returns null once every milestone is reached", () => {
    expect(nextMilestone(30)).toBeNull();
    expect(nextMilestone(50)).toBeNull();
  });
});

describe("progressMessage", () => {
  it("progressMessage(0,1) includes welcome AND first-concept milestone", () => {
    const msg = progressMessage(0, 1);
    expect(msg).not.toBeNull();
    // includes welcome
    expect(msg).toContain("Welcome to Lumi");
    // includes first-concept milestone
    expect(msg).toContain(milestoneFor(1)!);
  });

  it("progressMessage(4,5) returns the 5-milestone with no welcome", () => {
    const msg = progressMessage(4, 5);
    expect(msg).not.toBeNull();
    expect(msg).toContain("Growing");
    expect(msg).not.toContain("Welcome to Lumi");
  });

  it("progressMessage(5,6) returns null", () => {
    expect(progressMessage(5, 6)).toBeNull();
  });
});
