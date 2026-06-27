import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConsent, allowsTool, allowsProject, allowsScope, type ConsentConfig,
} from "../src/session/consent-config";

function home(contents?: object): string {
  const dir = mkdtempSync(join(tmpdir(), "lumi-consent2-"));
  if (contents) writeFileSync(join(dir, "consent.json"), JSON.stringify(contents));
  return dir;
}

describe("loadConsent", () => {
  it("defaults to disabled with all scopes on when no file exists", () => {
    const c = loadConsent(home());
    expect(c.enabled).toBe(false);
    expect(c.scopes).toEqual({ commands: true, output: true, aiText: true });
    expect(c.projects.mode).toBe("all");
  });

  it("reads the Phase-1 boolean shape (aiSessions) as enabled", () => {
    expect(loadConsent(home({ aiSessions: true })).enabled).toBe(true);
    expect(loadConsent(home({ aiSessions: false })).enabled).toBe(false);
  });

  it("reads the layered shape and fills missing fields with defaults", () => {
    const c = loadConsent(home({
      enabled: true,
      tools: { codex: false },
      projects: { mode: "allowlist", allow: ["C:/work"] },
      scopes: { aiText: false },
    }));
    expect(c.enabled).toBe(true);
    expect(c.tools).toEqual({ codex: false });
    expect(c.scopes).toEqual({ commands: true, output: true, aiText: false });
    expect(c.projects).toEqual({ mode: "allowlist", allow: ["C:/work"] });
  });
});

describe("consent predicates", () => {
  const base: ConsentConfig = {
    enabled: true,
    tools: { codex: false },
    projects: { mode: "allowlist", allow: ["C:/work", "C:/proj"] },
    scopes: { commands: true, output: false, aiText: true },
  };

  it("allowsTool: explicit false blocks, anything else allows", () => {
    expect(allowsTool(base, "codex")).toBe(false);
    expect(allowsTool(base, "claude-code")).toBe(true);
  });

  it("allowsProject: allowlist matches by path prefix, normalizing slashes", () => {
    expect(allowsProject(base, "C:/work/app")).toBe(true);
    expect(allowsProject(base, "C:\\proj\\sub")).toBe(true);
    expect(allowsProject(base, "C:/other")).toBe(false);
    expect(allowsProject({ ...base, projects: { mode: "all", allow: [] } }, "C:/anywhere")).toBe(true);
  });

  it("allowsScope: explicit false blocks that scope", () => {
    expect(allowsScope(base, "output")).toBe(false);
    expect(allowsScope(base, "commands")).toBe(true);
    expect(allowsScope(base, "aiText")).toBe(true);
  });
});
