import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctorReport } from "../src/doctor";
import { JsonFileProfile } from "../src/profile";

describe("doctorReport", () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lumi-doctor-"));
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("claudeAvailable:false → contains 'not found' and 'offline'", () => {
    const report = doctorReport({ home, claudeAvailable: false });
    expect(report).toContain("not found");
    expect(report).toContain("offline");
  });

  it("claudeAvailable:true → contains 'Claude CLI found'", () => {
    const report = doctorReport({ home, claudeAvailable: true });
    expect(report).toContain("Claude CLI found");
  });

  it("no profile.json → contains 'No learning history yet'", () => {
    const report = doctorReport({ home, claudeAvailable: false });
    expect(report).toContain("No learning history yet");
  });

  it("seeded profile.json → contains 'you've learned 2 concepts' and a level word", () => {
    const profile = new JsonFileProfile(join(home, "profile.json"));
    profile.markLearned("git-commit");
    profile.markLearned("git-push");
    const report = doctorReport({ home, claudeAvailable: true });
    expect(report).toContain("you've learned 2 concepts");
    expect(report).toMatch(/beginner|growing|confident/);
  });

  it("feed.jsonl present and non-empty → contains 'Lesson feed is active'", () => {
    const feedFile = join(home, "feed.jsonl");
    writeFileSync(feedFile, '{"v":1,"type":"lesson"}\n', "utf8");
    const report = doctorReport({ home, claudeAvailable: true });
    expect(report).toContain("Lesson feed is active");
  });

  it("feed.jsonl absent → contains 'No lesson feed yet'", () => {
    const report = doctorReport({ home, claudeAvailable: false });
    expect(report).toContain("No lesson feed yet");
  });

  it("singularizes 'concept' when exactly 1 concept is learned", () => {
    const profile = new JsonFileProfile(join(home, "profile.json"));
    profile.markLearned("git-commit");
    const report = doctorReport({ home, claudeAvailable: true });
    expect(report).toContain("you've learned 1 concept (level:");
  });

  it("report always starts with the header line", () => {
    const report = doctorReport({ home, claudeAvailable: true });
    expect(report).toContain("Lumi setup check");
  });

  it("lists detected tools and nudges setup when tools are present", () => {
    const report = doctorReport({ home, claudeAvailable: true, tools: ["codex", "cursor"] });
    expect(report).toContain("AI tools detected: codex, cursor");
    expect(report).toContain("lumi setup --all");
  });

  it("hints to install a tool when none are detected", () => {
    const report = doctorReport({ home, claudeAvailable: true, tools: [] });
    expect(report).toContain("No AI coding tool configs found");
  });

  it("shows Pro status with expiry, and the free-plan line otherwise", () => {
    expect(doctorReport({ home, claudeAvailable: true, tier: "pro", expires: "2027-06-16T00:00:00Z" }))
      .toContain("Lumi Pro is active (until 2027-06-16)");
    expect(doctorReport({ home, claudeAvailable: true, tier: "free" }))
      .toContain("free plan");
  });
});
