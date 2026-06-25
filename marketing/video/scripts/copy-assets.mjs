// marketing/video/scripts/copy-assets.mjs
// Copy rendered media into the surfaces that ship them.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repo = resolve(root, "..", "..");

const jobs = [
  ["out/lumi-ide-1x1.mp4", "vscode-extension/media/lumi-ide-1x1.mp4"],
  ["out/lumi-ide-1x1.webm", "vscode-extension/media/lumi-ide-1x1.webm"],
  ["out/lumi-ide-poster.jpg", "vscode-extension/media/lumi-ide-poster.jpg"],
  ["out/lumi-ide.gif", "vscode-extension/media/lumi-ide.gif"],
  ["out/lumi-hero-16x9.mp4", "web-landing/assets/lumi-hero-16x9.mp4"],
  ["out/lumi-hero-16x9.webm", "web-landing/assets/lumi-hero-16x9.webm"],
  ["out/lumi-hero-poster.jpg", "web-landing/assets/lumi-hero-poster.jpg"],
];

let missing = 0;
for (const [src, dest] of jobs) {
  const s = resolve(root, src);
  const d = resolve(repo, dest);
  if (!existsSync(s)) { console.warn("MISSING (run render first):", src); missing++; continue; }
  mkdirSync(dirname(d), { recursive: true });
  copyFileSync(s, d);
  console.log("copied", dest);
}
process.exit(missing ? 1 : 0);
