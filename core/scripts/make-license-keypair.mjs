#!/usr/bin/env node
/**
 * make-license-keypair.mjs
 *
 * Generates an Ed25519 keypair for the Lumi license system.
 *
 * Usage:
 *   node core/scripts/make-license-keypair.mjs
 *
 * What this does:
 *   1. Generates a fresh Ed25519 keypair.
 *   2. Prints the PUBLIC key PEM to stdout — copy this into core/src/license.ts
 *      as LUMI_PUBLIC_KEY (replacing the placeholder).
 *   3. Writes the PRIVATE key PEM to ./lumi-license-private.pem in the current
 *      working directory (gitignored — keep it safe, never commit it).
 *
 * Security note:
 *   The private key lets you sign license keys. Store it outside the repo
 *   (a password manager or secrets vault). Anyone who has it can create
 *   valid Pro license keys, so treat it like a root password.
 */

import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const privateKeyFile = resolve(process.cwd(), "lumi-license-private.pem");
writeFileSync(privateKeyFile, privateKey, { mode: 0o600 });

console.log("=".repeat(60));
console.log("LUMI LICENSE KEYPAIR GENERATED");
console.log("=".repeat(60));
console.log();
console.log("PUBLIC KEY (embed this in core/src/license.ts as LUMI_PUBLIC_KEY):");
console.log("-".repeat(60));
console.log(publicKey);
console.log("-".repeat(60));
console.log();
console.log(`PRIVATE KEY written to: ${privateKeyFile}`);
console.log();
console.log("IMPORTANT:");
console.log("  - The private key file is gitignored. Do NOT commit it.");
console.log("  - Copy the public key above into core/src/license.ts,");
console.log("    replacing the PLACEHOLDER value in LUMI_PUBLIC_KEY.");
console.log("  - Back up the private key in a password manager or secrets vault.");
console.log("  - Use core/scripts/sign-license.mjs to issue license keys.");
