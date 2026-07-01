// Build the Lumi server sidecar: compile the engine, then package
// core/dist/server-bin.js into a single self-contained Windows exe named for
// the Tauri sidecar target-triple convention (…-x86_64-pc-windows-msvc.exe).
import { execSync } from "node:child_process";
import { mkdirSync, renameSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const overlayRoot = resolve(here, "..");
const repoRoot = resolve(overlayRoot, "..");
const binaries = join(overlayRoot, "src-tauri", "binaries");
const TRIPLE = "x86_64-pc-windows-msvc";

const run = (cmd, cwd) => execSync(cmd, { stdio: "inherit", cwd });

// 1. Build the engine (produces core/dist/server-bin.js).
run("npm run build --workspace core", repoRoot);

// 2. Package the standalone entry into one exe (Node 22 runtime baked in).
mkdirSync(binaries, { recursive: true });
const entry = join(repoRoot, "core", "dist", "server-bin.js");
const tmpOut = join(binaries, "lumi-serve.exe");
if (existsSync(tmpOut)) rmSync(tmpOut);
run(`npx pkg "${entry}" --targets node22-win-x64 --output "${tmpOut}"`, overlayRoot);

// 3. Rename to the Tauri externalBin target-triple convention.
const finalPath = join(binaries, `lumi-serve-${TRIPLE}.exe`);
if (existsSync(finalPath)) rmSync(finalPath);
renameSync(tmpOut, finalPath);
console.log(`sidecar ready: ${finalPath}`);
