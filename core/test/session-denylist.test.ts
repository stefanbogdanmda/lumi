import { describe, it, expect } from "vitest";
import { isSensitiveCommand } from "../src/session/denylist";

describe("isSensitiveCommand", () => {
  it("flags secret-dumping commands", () => {
    for (const cmd of [
      "env",
      "printenv",
      "cat .env",
      "type .env",
      "cat ~/.ssh/id_rsa",
      "openssl rsa -in key.pem",
      "gpg --export-secret-keys",
      "cat server.pem",
      "vault read secret/db",
      "op item get prod",
      "cat ~/.npmrc",
      "cat .git-credentials",
      "ssh-keygen -y -f id_ed25519",
    ]) {
      expect(isSensitiveCommand(cmd), cmd).toBe(true);
    }
  });

  it("flags credential-prompt contexts", () => {
    expect(isSensitiveCommand("sudo systemctl restart nginx")).toBe(true);
    expect(isSensitiveCommand("ssh deploy@host")).toBe(true);
  });

  it("does not flag ordinary commands", () => {
    for (const cmd of ["npm test", "git status", "ls -la", "node build.js", "cat README.md"]) {
      expect(isSensitiveCommand(cmd), cmd).toBe(false);
    }
  });

  it("is case-insensitive and tolerant of leading whitespace", () => {
    expect(isSensitiveCommand("   ENV  ")).toBe(true);
  });
});
