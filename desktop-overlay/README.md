# Lumi Overlay — Tauri v2 Native Window

> UNVERIFIED SCAFFOLD — This is a starting-point for the founder to run on a real PC.
> It has not been compiled or executed in the build environment (no Rust toolchain is
> available there). Config details may need a version-specific tweak depending on
> the exact Tauri v2 release installed. See the checklist at the bottom.

## What this is

A frameless, always-on-top native desktop window (built with Tauri v2) that wraps
the existing Lumi web overlay served by `lumi serve` on `http://localhost:4321`.

The Tauri frontend is a minimal redirect page. All the real UI lives in the web
overlay — this shell adds native polish: no OS title-bar, stays above other windows,
can be made transparent, starts at a sensible size.

**The web overlay alone (a browser window pinned on top) already works today.**
This is the optional native-polish upgrade, not a prerequisite.

## Prerequisites

1. **Rust + cargo** — install via https://rustup.rs (`curl --proto '=https' --tlsv1.2 -sSf https://rustup.rs | sh`)
2. **Node.js 18+** and **npm 9+**
3. **Tauri v2 system dependencies** for your OS:
   - Linux: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
     (package names vary by distro — see https://v2.tauri.app/start/prerequisites/)
   - macOS: Xcode Command Line Tools (`xcode-select --install`)
   - Windows: Microsoft C++ Build Tools + WebView2 (usually pre-installed on Win 11)
4. **`lumi serve` must be running** at `http://localhost:4321` before you open the overlay.
   Start it in a separate terminal: `lumi serve` (or however your local Lumi dev server starts).

## Run in development

```bash
cd desktop-overlay
npm install
npm run tauri dev
```

A frameless, always-on-top window (420 × 620 px) should appear loading `http://localhost:4321`.

## Build for distribution

Icons must be generated before a production build. Provide a square PNG (1024 × 1024
recommended) and run:

```bash
npm run tauri icon path/to/your-icon.png
```

This populates `src-tauri/icons/` with all required sizes. Then:

```bash
npm run tauri build
```

Distributable bundles appear in `src-tauri/target/release/bundle/`.

## Window behaviour

| Property | Value |
|---|---|
| Size | 420 × 620 (min 320 × 360) |
| Decorations | None (frameless) |
| Always on top | Yes |
| Transparent | Yes (for custom CSS chrome) |
| Resizable | Yes |

These are set in `src-tauri/tauri.conf.json` and can be adjusted there.

## Architecture

```
lumi serve (http://localhost:4321)
        ▲
        │  HTTP (localhost only)
        │
  Tauri webview  ←  src/index.html (meta-refresh redirect)
  (frameless OS window, always-on-top)
```

All lesson logic lives in `@lumi/core` and the web overlay. This Tauri shell is
intentionally thin — it owns only the native window chrome.

## Known limitations and things to verify at the PC

- [ ] `npm run tauri dev` opens a window and loads the web overlay without errors.
- [ ] Window is frameless (no OS title bar) and floats above other windows.
- [ ] Window is draggable (requires a draggable region defined in the web overlay CSS —
      add `-webkit-app-region: drag` to the header element in the web overlay).
- [ ] `npm run tauri build` completes after icons are generated.
- [ ] Always-on-top behaviour works on your specific OS + window manager. There are
      known quirks on some Linux compositors (see https://github.com/tauri-apps/tauri/issues/9439).
- [ ] The `tauri.conf.json` `$schema` URL resolves correctly for the exact Tauri CLI
      version installed. If the CLI rejects the config, remove the `$schema` line and
      re-run — it is advisory only.
- [ ] `"security": { "csp": null }` disables CSP for the webview. This is intentional
      because the frontend is a localhost redirect and the real CSP lives in the web
      overlay's HTTP headers. If you tighten this, ensure `http://localhost:4321` is
      allowed as a frame-src / connect-src.

## File layout

```
desktop-overlay/
  package.json            npm package (devDep: @tauri-apps/cli ^2)
  src/
    index.html            meta-refresh → http://localhost:4321/
  src-tauri/
    tauri.conf.json       Tauri v2 window + bundle config
    Cargo.toml            Rust manifest
    build.rs              tauri-build call
    src/
      main.rs             Tauri app entry point
    icons/
      README.md           Placeholder — run `tauri icon` to populate
```
