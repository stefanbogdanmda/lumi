#!/usr/bin/env node
// png-to-ico.mjs — wrap a PNG into a single-entry .ico (PNG-compressed, Vista+).
//
// This is a ZERO-DEPENDENCY placeholder generator so `tauri build` on Windows has
// an icon.ico without needing the full `tauri icon` toolchain. It does NOT resize:
// it embeds the source PNG verbatim. For the canonical multi-resolution icon set,
// run scripts/gen-icons.(ps1|sh) instead (that uses `@tauri-apps/cli icon`).
//
// Usage: node scripts/png-to-ico.mjs <input.png> <output.ico>

import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("Usage: node png-to-ico.mjs <input.png> <output.ico>");
  process.exit(1);
}

const png = readFileSync(inPath);

// ICONDIR header (6 bytes) + one ICONDIRENTRY (16 bytes).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(1, 4); // image count

const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // width  (0 => 256)
entry.writeUInt8(0, 1); // height (0 => 256)
entry.writeUInt8(0, 2); // color palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8); // size of image data
entry.writeUInt32LE(6 + 16, 12); // offset of image data

writeFileSync(outPath, Buffer.concat([header, entry, png]));
console.log(`Wrote ${outPath} (${(png.length / 1024).toFixed(1)} KB, PNG-embedded ICO)`);
