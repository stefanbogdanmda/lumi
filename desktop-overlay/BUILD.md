# Building the Lumi Desktop Overlay

This is the step-by-step guide to get the floating Lumi window on screen. It is
written to be followed top-to-bottom, even if you are not a Rust developer.

> The overlay is a thin native window that frames Lumi's existing web overlay
> (`lumi serve`). It starts that server for you and floats on top of everything.

---

## Two ways to get Lumi on screen

- **Just use it (recommended):** download `Lumi-Setup.exe` from the latest
  [GitHub Release](https://github.com/stefanbogdanmda/lumi/releases) and run it —
  no Node, no Rust, no terminal. Windows may show a one-time SmartScreen warning
  for the unsigned installer: click **More info → Run anyway**.
- **Build it yourself (this guide):** for contributors. Requires Node, Rust, and
  the MSVC build tools; produces the same installer via `npm run dist:win`.

### Build the installer

```bash
cd desktop-overlay
npm install
npm run dist:win   # builds the sidecar, then the NSIS installer
# → src-tauri/target/release/bundle/nsis/Lumi_<version>_x64-setup.exe
```

---

## 0. Prerequisites (one-time)

You need three things installed: **Node**, **Rust**, and (on Windows) the
**MSVC build tools**. WebView2 ships with Windows 11, so there's nothing extra to
install there.

### a) Node.js 20+

You almost certainly already have this (the rest of Lumi uses it; CI builds on Node 20). Check:

```bash
node --version
```

### b) Rust (this is the new requirement)

The overlay's native shell is written in Rust, so you need the Rust toolchain.

**Windows (recommended — one command):**

```powershell
winget install Rustlang.Rustup
```

Then open a **new** terminal and set the default toolchain:

```powershell
rustup default stable
```

If you don't have `winget`, download and run `rustup-init.exe` from
<https://rustup.rs> instead, then run `rustup default stable`.

**macOS / Linux:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
```

Verify:

```bash
rustc --version
cargo --version
```

### c) Platform build tools

- **Windows:** Microsoft **C++ Build Tools** (the MSVC linker). If `tauri dev`
  later complains about `link.exe`, install "Desktop development with C++" from
  the Visual Studio Build Tools installer:
  <https://visualstudio.microsoft.com/visual-cpp-build-tools/>.
  **WebView2** is already present on Windows 11.
- **macOS:** Xcode Command Line Tools — `xcode-select --install`.
- **Linux:** WebKitGTK and friends, e.g. on Debian/Ubuntu:
  `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  (package names vary by distro — see <https://v2.tauri.app/start/prerequisites/>).

---

## 1. Install JS dependencies

```bash
cd desktop-overlay
npm install
```

This fetches `@tauri-apps/cli` (a prebuilt binary — no compiling). It does **not**
build the Rust app yet; that happens on first `tauri dev`/`tauri build`.

---

## 2. Icons (optional — placeholders already committed)

`src-tauri/icons/` already contains `icon.png` and `icon.ico` placeholders, so you
can skip this and still build. For the crisp, canonical multi-resolution set:

```bash
# macOS / Linux
./scripts/gen-icons.sh
# Windows
.\scripts\gen-icons.ps1
```

(These call `npx @tauri-apps/cli icon …`; Rust is not needed for icon generation.)

---

## 3. Run the overlay (development)

```bash
npm run tauri dev
```

The **first** run compiles the Rust shell and can take a few minutes. Subsequent
runs are fast. A decorated, always-on-top window (400 × 640) with a native title
bar appears once the overlay server is reachable. It is opaque (espresso
background) so there is no see-through dead-zone, and you move/minimize/close it
with the normal OS title bar.

You do **not** need to start `lumi serve` yourself — the app spawns the bundled
`lumi-serve` sidecar for you (see "How the server starts" below).

> **Build the sidecar first.** `tauri dev` does **not** build the sidecar. If
> `src-tauri/binaries/lumi-serve-x86_64-pc-windows-msvc.exe` is missing, the window
> opens but the overlay never loads (the shell logs `sidecar not found` and times
> out). Run `npm run build:sidecar` once before `npm run tauri dev`, or just use
> `npm run dist:win` for a full packaged build.

If you'd rather use the helper that also tidies up the server on exit:

```bash
# macOS / Linux
./scripts/run.sh
# Windows
.\scripts\run.ps1
```

---

## 4. Package for distribution

```bash
npm run dist:win
```

This builds the sidecar (`build:sidecar`) and then runs `tauri build`, producing the
NSIS installer at `src-tauri/target/release/bundle/nsis/Lumi_<version>_x64-setup.exe`.
Make sure icons exist first (step 2 — placeholders are enough to succeed).

> The packaged installer is fully self-contained: it bundles the `lumi-serve` sidecar
> (which has its own Node runtime baked in), so **end users need neither Node nor
> `lumi serve` on their machine**. Everything binds `127.0.0.1` only.

---

## How the server starts (and stops)

The native shell (`src-tauri/src/lib.rs`) handles the lifecycle so launching is
one command:

1. On launch it checks whether `127.0.0.1:4321` is already serving (so it won't
   clash with a `lumi serve` you started yourself in dev).
2. If not, it spawns the **bundled `lumi-serve` sidecar** via `tauri-plugin-shell`
   (`app.shell().sidecar("lumi-serve")`) with `--port 4321`. The sidecar is a
   self-contained executable declared as an `externalBin` in `tauri.conf.json` — no
   system Node and no monorepo layout are required at runtime.
3. It waits (up to ~15s) for the port to accept a connection, then reveals the window.
4. When you close the window (or the app exits), it kills the sidecar it started —
   `Mutex<Option<CommandChild>>` + `.take()` makes the kill idempotent, so no orphan
   process is left behind.

If the server isn't reachable yet, the window shows a "Starting Lumi…" screen and
keeps retrying until the sidecar answers.

**Port contract:** the sidecar binds `127.0.0.1:4321` and serves the overlay UI at
`http://localhost:4321/`. If core ever changes that port, update `OVERLAY_PORT` in
`src-tauri/src/lib.rs`, the URL in `src/index.html`, and the scripts.
