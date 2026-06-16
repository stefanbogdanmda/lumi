import type { ScoredConcept } from "./detector";
import { OutputSignals } from "./types";

/** Strong, unambiguous mappings from a command or file pattern to a concept id. */
const COMMAND_RULES: { pattern: RegExp; id: string }[] = [
  { pattern: /\bgit\s+commit\b/i, id: "git-commit" },
  { pattern: /\bgit\s+branch\b|\bgit\s+checkout\b|\bgit\s+switch\b/i, id: "git-branch" },
  { pattern: /\bgit\s+push\b/i, id: "git-push" },
  { pattern: /\bgit\s+pull\b/i, id: "git-pull" },
  { pattern: /\bgit\s+merge\b/i, id: "git-merge" },
  { pattern: /\bgit\s+diff\b/i, id: "git-diff" },
  { pattern: /\b(npm|pnpm|yarn)\s+(install|add|i)\b/i, id: "npm-install" },
  { pattern: /\b(npm|pnpm|yarn)\s+run\b/i, id: "npm-script" },
  { pattern: /\bdocker\b/i, id: "docker" },
  { pattern: /\bssh\b/i, id: "ssh" },
  { pattern: /\bcurl\b|\bwget\b/i, id: "http-request" },
];

const FILE_RULES: { pattern: RegExp; id: string }[] = [
  { pattern: /(^|\/)Dockerfile$/i, id: "docker" },
  { pattern: /\.json$/i, id: "json" },
  { pattern: /(^|\/)package\.json$/i, id: "npm-script" },
  { pattern: /\.ya?ml$/i, id: "ci" },
  { pattern: /\.sh$/i, id: "shell-script" },
  { pattern: /(^|\/)\.env(\.|$)/i, id: "env-var" },
  { pattern: /\.test\.(t|j)sx?$/i, id: "test-suite" },
];

const COMMAND_SCORE = 3; // actions are stronger evidence than prose
const FILE_SCORE = 2;

/** Derive scored concepts from the concrete actions Claude took. */
export function conceptsFromSignals(signals: OutputSignals): ScoredConcept[] {
  const scores = new Map<string, number>();
  const add = (id: string, by: number) => scores.set(id, (scores.get(id) ?? 0) + by);
  for (const cmd of signals.commands ?? []) {
    for (const rule of COMMAND_RULES) if (rule.pattern.test(cmd)) add(rule.id, COMMAND_SCORE);
  }
  for (const file of signals.files ?? []) {
    for (const rule of FILE_RULES) if (rule.pattern.test(file)) add(rule.id, FILE_SCORE);
  }
  return [...scores.entries()].map(([id, score]) => ({ id, score }));
}
