const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  outfile: "out/extension.js",
  sourcemap: false,
  minify: process.argv.includes("--minify"),
}).then(() => console.log("bundled")).catch((e) => { console.error(e); process.exit(1); });
