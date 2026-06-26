#!/usr/bin/env node
import { runCli, readStdin } from "./cli";

async function main() {
  const argv = process.argv.slice(2);
  const stdinCmds = new Set(["feed", "check", "unstuck", "audit", "term"]);
  const input = stdinCmds.has(argv[0]) ? await readStdin() : undefined;
  const code = await runCli(argv, input !== undefined ? { input } : {});
  if (argv[0] !== "serve") process.exit(code); // serve keeps the process alive to run the server
}
main();
