# Lumi Overlay — Tauri v2 Native Window

A compact, always-on-top desktop window (Tauri v2) that frames Lumi's existing
web overlay. It floats above VS Code, your browser, and everything else — this is
how Lumi gets "out of the box."

> **v1 = decorated window (native title bar).** The overlay is loaded from a
> remote origin (`http://localhost:4321/`), where Tauri's JS APIs and
> `data-tauri-drag-region` do **not** reliably inject — so a custom frameless
> titlebar can't drag or close the window. v1 therefore uses a normal **decorated,
> opaque** window: you get free move/minimize/close from the OS, and no
> see-through dead-zone. Frameless custom chrome is a future option (see
> "Future: frameless custom chrome" below).

> **Build status:** the native shell (Rust) and config are **authored but not yet
> compiled** — no Rust toolchain was available on the authoring machine. Everything
> else (config, icons, HTML, scripts) is in place. After installing Rust,
> `npm run tauri dev` is the single command to compile and launch. See
> **[BUILD.md](./BUILD.md)** for the exact, beginner-friendly steps.

## What it is

The Tauri frontend is a tiny loading page that redirects to the running overlay at
`http://localhost:4321/`. All the real UI — the 9-tab overlay fed by
`~/.lumi/feed.jsonl` over SSE — lives in `lumi serve` (in `core/`). This shell only
adds native polish: a slim native title bar, always-on-top, opaque espresso
background, sensible size.

```
 ┌─────────────────────────────┐
 │  Tauri window (decorated,    │   src/index.html → loading/redirect
 │  always-on-top, opaque)      │
 │     ▼ loads                  │
 │  http://localhost:4321/      │ ◄── lumi serve  (@lumi/core, 127.0.0.1:4321)
 └─────────────────────────────┘      serves the full overlay UI
```

## One-command launch

```bash
cd desktop-overlay
npm install        # once
npm run tauri dev  # compiles the Rust shell (first run only) and opens the window
```

The shell **starts `lumi serve` for you**, waits for it to answer, then reveals the
window — and stops the server when you close it. You do not need a second terminal.
Full prerequisites and packaging steps are in **[BUILD.md](./BUILD.md)**.

## Window behaviour

| Property         | Value                                          |
| ---------------- | ---------------------------------------------- |
| Size             | 400 × 640 (min 360 × 500)                      |
| Decorations      | Native title bar (move / minimize / close)     |
| Always on top    | Yes                                            |
| Transparent      | No (opaque)                                     |
| Background color | `#1a1411` (espresso — avoids white load flash) |
| Resizable        | Yes                                            |
| Initial state    | Hidden until `localhost:4321` responds         |

Set in `src-tauri/tauri.conf.json`. Permissions for the `main` window are granted
in `src-tauri/capabilities/default.json` (`core:default`).

### Future: frameless custom chrome

To go frameless (`decorations: false`) with a custom draggable titlebar and
working close/minimize buttons, the overlay UI must be **bundled as the local
Tauri frontend** instead of loaded from the remote `http://localhost:4321/`
origin. Only then do Tauri's JS APIs and `data-tauri-drag-region` inject
reliably. That is a larger change (ship the overlay's HTML/JS as `frontendDist`,
or proxy it) and is intentionally out of scope for v1.

## Design

- **Thin shell, fat overlay.** All lesson logic stays in `@lumi/core` and the web
  overlay. This crate owns only native window chrome + the `lumi serve` lifecycle.
- **Server lifecycle in Rust** (`src-tauri/src/lib.rs`): spawn `lumi serve` if not
  already running → health-poll the port → show the window → kill on exit. It
  prefers `node <repo>/core/dist/cli-bin.js serve` for a clean kill, falls back to
  `lumi` on PATH, and honors a `LUMI_SERVE_JS` override.
- **Loading page** (`src/index.html`) retries the port on its own, so a cold start
  shows "Starting Lumi…" instead of a dead page.

## File layout

```
desktop-overlay/
  package.json              scripts: tauri / dev / build / icons; devDep @tauri-apps/cli ^2
  BUILD.md                  full setup + packaging guide
  scripts/
    run.ps1 / run.sh        fallback launchers (start lumi serve, then tauri dev)
    gen-icons.ps1 / .sh     regenerate the canonical icon set via @tauri-apps/cli
    png-to-ico.mjs          zero-dep PNG→ICO used to seed the placeholder icon.ico
  src/
    index.html              loading page → http://localhost:4321/ (auto-retry)
  src-tauri/
    tauri.conf.json         window + bundle config (identifier app.lumi.overlay)
    Cargo.toml              Rust manifest (lib + bin)
    build.rs                tauri-build
    src/
      main.rs               entrypoint → lumi_overlay_lib::run()
      lib.rs                window + server lifecycle (AUTHORED, NOT COMPILED)
    icons/
      icon.png, icon.ico    placeholders (real Lumi icon); regenerate for crisp sizes
```

## Assumptions the rest of Lumi must honor

- `lumi serve` binds **`127.0.0.1:4321`** and serves the overlay at
  `http://localhost:4321/`. If that changes, update `OVERLAY_PORT` in
  `src-tauri/src/lib.rs`, the URL in `src/index.html`, and the scripts.
- `lumi` is the bin from `@lumi/core` (`core/dist/cli-bin.js`, built via
  `npm run build` in `core/`).

## To verify on a Rust-equipped machine

- [ ] `npm run tauri dev` compiles `lib.rs` and opens the window (fix any
      version-specific Tauri v2 API tweaks if the first compile complains).
- [ ] The window has a native title bar, is movable, opaque (espresso `#1a1411`),
      and floats above other windows.
- [ ] `lumi serve` is auto-started and the overlay loads; closing the window stops it.
- [ ] `npm run tauri build` completes (icons present).
```
