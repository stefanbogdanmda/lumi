/**
 * Self-contained HTML document for the Lumi web overlay (roadmap 10.2).
 *
 * Design notes:
 *  - Style and core script are inline. The one exception is the terminal panel,
 *    which lazily loads /vendor/xterm.css|js + /vendor/addon-fit.js from the
 *    same origin only when the user opens it.
 *  - CSP allows 'unsafe-inline' styles/scripts, plus 'self' for fetch/SSE and the
 *    lazily-loaded same-origin xterm assets.
 *  - Always-on-top behaviour is set by the OS window manager or the Electron/Tauri
 *    shell that hosts this page; the browser itself does not expose that API.
 *  - escapeHtml() is the single guard for every dynamic string.
 */

export const OVERLAY_HTML: string = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lumi Overlay</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Dark Warm Glow — the default, unconditional brand palette ──────
       Espresso + amber + cream. Not gated on prefers-color-scheme: this is
       a branded pinned tool, not an OS-themed page. Tokens mirror the
       desktop-overlay loader (#1a1411 / #e8a13a / #f3e9dd). */
    :root {
      --backdrop: #120d0b;                       /* behind a centered widget   */
      --bg: #1a1411;                             /* espresso widget surface    */
      --surface: #241a15;                        /* raised surface             */
      --surface2: #2e211a;                       /* deeper raised surface      */
      --border: rgba(243, 233, 221, 0.10);       /* warm low-opacity cream     */
      --border-strong: rgba(243, 233, 221, 0.18);
      --accent: #e8a13a;                          /* amber                      */
      --accent-dim: #c8842a;                      /* darker amber (hover)       */
      --accent-soft: rgba(232, 161, 58, 0.14);    /* amber focus ring / tint    */
      --on-accent: #1a1411;                       /* espresso text on amber     */
      --text: #f3e9dd;                            /* cream                      */
      --text-muted: #b8a797;                      /* muted warm                 */
      --green: #5fd093;                           /* AA-safe success on dark    */
      --radius: 14px;
      --shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
      --header-h: 48px;
      --tab-h: 42px;
      --transition: 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    html, body {
      height: 100%;
      background: var(--backdrop);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: var(--text);
      -webkit-font-smoothing: antialiased;
    }
    body { display: flex; justify-content: center; }

    /* ── Widget shell ──────────────────────────────────────────────────
       Fills its window. In a narrow desktop window width:100% = the window;
       in a wide browser tab the width caps at 560px and centers, so it never
       stretches absurdly. No fixed offsets, no rounded clipping. */
    #widget {
      position: relative;
      width: 100%;
      max-width: 560px;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      border-left: 1px solid var(--border);
      border-right: 1px solid var(--border);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    /* faint amber atmosphere bleeding down from the top */
    #widget::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 180px;
      background: radial-gradient(120% 100% at 50% 0%, rgba(232, 161, 58, 0.10), transparent 72%);
      pointer-events: none;
      z-index: 0;
    }

    /* ── Header ────────────────────────────────────────────────────────── */
    #widget-header {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      height: var(--header-h);
      padding: 0 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      user-select: none;
    }
    #brand-dot {
      width: 9px; height: 9px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 14px 3px rgba(232, 161, 58, 0.55);
      flex-shrink: 0;
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: .5; transform: scale(.9); } 50% { opacity: 1; transform: scale(1); } }
    #header-title {
      flex: 1;
      min-width: 0;
      font-weight: 700;
      font-size: 16px;
      color: var(--text);
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #header-title .tagline {
      color: var(--text-muted);
      font-weight: 500;
      font-size: 12px;
      letter-spacing: 0.01em;
    }

    /* ── Body ──────────────────────────────────────────────────────────── */
    #widget-body {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Tab navigation — a horizontal strip with gradient fade edges ──── */
    #tab-nav {
      position: relative;
      flex-shrink: 0;
      border-bottom: 1px solid var(--border);
    }
    #tab-nav::before,
    #tab-nav::after {
      content: "";
      position: absolute;
      top: 0; bottom: 1px;
      width: 32px;
      pointer-events: none;
      z-index: 2;
      opacity: 0;
      transition: opacity var(--transition);
    }
    #tab-nav::before { left: 0;  background: linear-gradient(to right, var(--bg), transparent); }
    #tab-nav::after  { right: 0; background: linear-gradient(to left,  var(--bg), transparent); }
    #tab-nav.fade-left::before  { opacity: 1; }
    #tab-nav.fade-right::after   { opacity: 1; }

    #tab-bar {
      display: flex;
      gap: 2px;
      align-items: stretch;
      height: var(--tab-h);
      padding: 0 10px;
      overflow-x: auto;
      overflow-y: hidden;
      flex-wrap: nowrap;
      scroll-behavior: smooth;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    #tab-bar::-webkit-scrollbar { height: 0; width: 0; display: none; }

    .tab-btn {
      position: relative;
      flex: 0 0 auto;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 0 13px;
      white-space: nowrap;
      letter-spacing: 0.01em;
      transition: color var(--transition);
    }
    .tab-btn::after {
      content: "";
      position: absolute;
      left: 13px; right: 13px;
      bottom: 7px;
      height: 2px;
      border-radius: 2px;
      background: var(--accent);
      box-shadow: 0 0 10px 1px rgba(232, 161, 58, 0.6);
      transform: scaleX(0);
      transform-origin: center;
      transition: transform var(--transition);
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn:focus-visible { outline: none; color: var(--text); }
    .tab-btn:focus-visible::after { transform: scaleX(0.5); background: var(--border-strong); box-shadow: none; }
    .tab-btn.active {
      color: var(--accent);
      text-shadow: 0 0 18px rgba(232, 161, 58, 0.45);
    }
    .tab-btn.active::after { transform: scaleX(1); }

    /* ── Tab panels ────────────────────────────────────────────────────── */
    #tab-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; animation: panel-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
    @keyframes panel-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

    /* ── Cards ─────────────────────────────────────────────────────────── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .card-title {
      font-weight: 700;
      font-size: 14px;
      color: var(--accent);
      margin-bottom: 6px;
    }
    .card-body { line-height: 1.55; color: var(--text); }
    .card-label {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      margin-top: 8px;
      margin-bottom: 2px;
    }
    .card-section { margin-top: 6px; }
    .card-section p { margin: 0; color: var(--text); line-height: 1.5; }

    /* analogy / example in lighter tone */
    .card-section.muted p { color: var(--text-muted); font-style: italic; }

    /* ── Command-failure card (terminal) ──────────────────────────────── */
    .failure-card {
      border-color: rgba(232, 161, 58, 0.45);
      border-left: 3px solid var(--accent);
    }
    .failure-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .failure-badge {
      flex: 1;
      font-weight: 700;
      font-size: 13.5px;
      color: var(--accent);
    }
    .failure-dismiss {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 6px;
      transition: color var(--transition), background var(--transition);
    }
    .failure-dismiss:hover { color: var(--text); background: var(--surface2); }
    .failure-cmd {
      font-family: ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace;
      font-size: 12.5px;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 7px 9px;
      margin-bottom: 8px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .failure-exit {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-soft);
      border-radius: 4px;
      padding: 1px 7px;
    }
    .failure-cwd { color: var(--text-muted); font-size: 11px; margin-left: 8px; }
    .failure-body { margin-top: 8px; line-height: 1.55; color: var(--text); }
    .failure-body p { margin: 0; }
    .failure-why { color: var(--text-muted); font-size: 12.5px; margin-top: 6px; line-height: 1.5; }

    /* ── Empty / loading states ─────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 44px 22px;
      line-height: 1.6;
      font-size: 13px;
    }
    .empty-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 18px 4px rgba(232, 161, 58, 0.45);
      margin: 0 auto 16px;
      animation: pulse 1.6s ease-in-out infinite;
    }
    .spinner {
      display: inline-block;
      width: 18px; height: 18px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Quick-check (Lessons tab — active recall before reveal) ───────── */
    .qc-prompt {
      font-size: 13px;
      color: var(--text-muted);
      font-style: italic;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .qc-reveal-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      cursor: pointer;
      transition: background var(--transition);
      margin-bottom: 6px;
    }
    .qc-reveal-btn:hover { background: var(--accent-dim); }
    .qc-body { display: none; }
    .qc-body.revealed { display: block; }

    /* ── Lesson cards (Lessons tab — collapsible + dismissible) ─────────── */
    .lesson-head {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .lesson-toggle {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      color: var(--accent);
      font-weight: 700;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      padding: 2px 0;
      border-radius: 4px;
    }
    .lesson-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lesson-check {
      display: none;
      flex-shrink: 0;
      color: var(--green);
      font-weight: 700;
    }
    .lesson-card.understood .lesson-check { display: inline; }
    .lesson-card.understood .lesson-title { color: var(--text-muted); }
    .lesson-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      font-size: 11px;
      transition: transform var(--transition);
    }
    .lesson-card.collapsed .lesson-chevron { transform: rotate(-90deg); }
    .lesson-toggle:hover .lesson-chevron { color: var(--text); }
    .lesson-dismiss {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
      transition: color var(--transition), background var(--transition);
    }
    .lesson-dismiss:hover { color: var(--text); background: var(--surface2); }

    /* Smooth accordion via animatable grid rows (reduced-motion neutralizes it) */
    .lesson-collapse {
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows var(--transition);
    }
    .lesson-card.collapsed .lesson-collapse { grid-template-rows: 0fr; }
    .lesson-collapse > .lesson-collapse-inner {
      overflow: hidden;
      min-height: 0;
    }
    .lesson-card.collapsed .lesson-collapse > .lesson-collapse-inner { opacity: 0; }
    .lesson-collapse > .lesson-collapse-inner { opacity: 1; transition: opacity var(--transition); }
    .lesson-body-pad { padding-top: 8px; }

    .lesson-gotit {
      margin-top: 12px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--green);
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      cursor: pointer;
      transition: background var(--transition);
    }
    .lesson-gotit:hover { background: var(--border); }

    /* ── Interactive glossary (Glossary tab) ───────────────────────────── */
    #glossary-head {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 10px;
    }
    #glossary-search {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 13px;
      padding: 9px 12px;
      margin-bottom: 12px;
    }
    #glossary-search::placeholder { color: var(--text-muted); }

    .gloss-cat { margin-bottom: 10px; }
    .gloss-cat-head {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      padding: 9px 12px;
      cursor: pointer;
      text-align: left;
      transition: background var(--transition), border-color var(--transition);
    }
    .gloss-cat-head:hover { background: var(--surface2); border-color: var(--border-strong); }
    .gloss-cat-label { flex: 1; min-width: 0; }
    .gloss-cat-count {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--surface2);
      border-radius: 999px;
      padding: 1px 8px;
    }
    .gloss-chevron, .gloss-row-chevron {
      flex-shrink: 0;
      color: var(--text-muted);
      font-size: 10px;
      transition: transform var(--transition);
    }
    .gloss-cat.collapsed .gloss-chevron { transform: rotate(-90deg); }

    .gloss-cat-body {
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows var(--transition);
    }
    .gloss-cat.collapsed .gloss-cat-body { grid-template-rows: 0fr; }
    .gloss-cat-body > .gloss-cat-inner { overflow: hidden; min-height: 0; }

    .gloss-row { border-bottom: 1px solid var(--border); }
    .gloss-cat-inner .gloss-row:last-child { border-bottom: none; }
    .gloss-term {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      color: var(--text);
      font-size: 13px;
      padding: 10px 8px 10px 14px;
      cursor: pointer;
      text-align: left;
      transition: color var(--transition);
    }
    .gloss-term:hover { color: var(--accent); }
    .gloss-term-label { flex: 1; min-width: 0; }
    .gloss-row.open .gloss-row-chevron { transform: rotate(180deg); }

    .gloss-detail {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows var(--transition);
    }
    .gloss-row.open .gloss-detail { grid-template-rows: 1fr; }
    .gloss-detail > .gloss-detail-inner { overflow: hidden; min-height: 0; }
    .gloss-detail-pad { padding: 0 14px 12px 14px; }
    .gloss-def { font-size: 13px; line-height: 1.55; color: var(--text); margin-bottom: 6px; }
    .gloss-analogy { font-size: 12px; font-style: italic; color: var(--text-muted); margin-bottom: 6px; }
    .gloss-meta { font-size: 11px; color: var(--text-muted); margin-bottom: 8px; }
    .gloss-learn {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      text-decoration: none;
    }
    .gloss-learn:hover { text-decoration: underline; }
    .gloss-learn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }

    /* ── Recall cards (Review tab) ─────────────────────────────────────── */
    .recall-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 12px;
      transition: opacity 0.4s ease;
    }
    .recall-card.done {
      opacity: 0.5;
    }
    .recall-prompt {
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
      margin-bottom: 10px;
    }
    .recall-prompt strong {
      color: var(--accent);
    }
    .recall-answer {
      background: var(--surface2);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
      font-size: 13px;
      line-height: 1.55;
      color: var(--text);
    }
    .recall-analogy {
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }
    .recall-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .recall-btn {
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      cursor: pointer;
      transition: background var(--transition), opacity var(--transition);
    }
    .recall-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .recall-btn-reveal {
      background: var(--surface2);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .recall-btn-reveal:hover:not(:disabled) {
      background: var(--border);
    }
    .recall-btn-remembered {
      background: var(--green);
      color: #0d1117;
    }
    .recall-btn-remembered:hover:not(:disabled) {
      opacity: 0.85;
    }
    .recall-btn-fuzzy {
      background: var(--surface2);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .recall-btn-fuzzy:hover:not(:disabled) {
      background: var(--border);
    }
    .recall-done-msg {
      font-size: 13px;
      color: var(--text-muted);
      font-style: italic;
    }

    /* ── Explain tab ────────────────────────────────────────────────────── */
    #explain-form {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    #explain-input {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color var(--transition);
    }
    #explain-input:focus {
      border-color: var(--accent);
    }
    #explain-input::placeholder { color: var(--text-muted); }
    #explain-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      cursor: pointer;
      transition: background var(--transition);
    }
    #explain-btn:hover { background: var(--accent-dim); }
    #explain-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Coach tab (lumi next) ──────────────────────────────────────────── */
    #coach-heading {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 12px;
      line-height: 1.5;
    }
    #coach-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 13px;
      font-weight: 600;
      padding: 7px 16px;
      cursor: pointer;
      transition: background var(--transition);
      margin-bottom: 14px;
      display: block;
    }
    #coach-btn:hover { background: var(--accent-dim); }
    #coach-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #coach-result {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.65;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
    }

    /* ── Prompt tab (lumi prompt) ───────────────────────────────────────── */
    #prompt-heading {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 10px;
      line-height: 1.5;
    }
    #prompt-textarea {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      outline: none;
      transition: border-color var(--transition);
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    #prompt-textarea:focus { border-color: var(--accent); }
    #prompt-textarea::placeholder { color: var(--text-muted); }
    #prompt-polish-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 13px;
      font-weight: 600;
      padding: 7px 16px;
      cursor: pointer;
      transition: background var(--transition);
      margin-bottom: 14px;
    }
    #prompt-polish-btn:hover { background: var(--accent-dim); }
    #prompt-polish-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #prompt-hint {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
      margin-bottom: 8px;
      min-height: 16px;
    }
    #prompt-output-wrap {
      display: none;
    }
    #prompt-output {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.65;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 8px;
    }
    #prompt-copy-btn {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      cursor: pointer;
      transition: background var(--transition);
    }
    #prompt-copy-btn:hover { background: var(--border); }

    /* ── Paste tab ──────────────────────────────────────────────────────── */
    #paste-heading {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 10px;
      line-height: 1.5;
    }
    #paste-textarea {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      min-height: 100px;
      outline: none;
      transition: border-color var(--transition);
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    #paste-textarea:focus { border-color: var(--accent); }
    #paste-textarea::placeholder { color: var(--text-muted); }
    #paste-hint {
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
      margin-bottom: 8px;
      min-height: 16px;
    }
    #paste-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 13px;
      font-weight: 600;
      padding: 7px 16px;
      cursor: pointer;
      transition: background var(--transition);
      margin-bottom: 14px;
    }
    #paste-btn:hover { background: var(--accent-dim); }
    #paste-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #paste-result {
      font-size: 13px;
      color: var(--green);
      line-height: 1.5;
      min-height: 18px;
    }
    .paste-risks { margin-top: 12px; }
    .paste-risks-head { font-size: 13px; color: var(--text); margin: 0 0 6px; font-weight: 600; }
    .paste-risk {
      border-left: 3px solid var(--border);
      padding: 6px 10px;
      margin: 6px 0;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
    }
    .paste-risk-high { border-left-color: #ff6b6b; }
    .paste-risk-medium { border-left-color: #ffc56b; }
    .paste-risk-label { font-size: 13px; font-weight: 600; color: var(--text); }
    .paste-risk-advice { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    /* ── Tier pill ───────────────────────────────────────────────────────── */
    #tier-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: var(--surface2);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    #tier-pill.pro {
      background: var(--accent);
      color: var(--on-accent);
      border-color: var(--accent);
    }

    /* ── Paths tab ───────────────────────────────────────────────────────── */
    .path-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .path-card.locked {
      opacity: 0.75;
    }
    .path-title {
      font-weight: 700;
      font-size: 14px;
      color: var(--accent);
      margin-bottom: 6px;
    }
    .path-bar-wrap {
      background: var(--surface2);
      border-radius: 4px;
      height: 8px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .path-bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .path-meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
    .path-next {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .path-locked-banner {
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .path-upgrade-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      font-size: 12px;
    }
    .path-upgrade-link:hover {
      text-decoration: underline;
    }
    .path-license-form {
      margin-top: 8px;
      display: none;
    }
    .path-license-form.visible {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .path-license-input {
      flex: 1;
      min-width: 120px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 8px;
      color: var(--text);
      font-size: 12px;
      font-family: inherit;
      outline: none;
    }
    .path-license-input:focus {
      border-color: var(--accent);
    }
    .path-license-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      cursor: pointer;
    }
    .path-license-btn:hover { opacity: 0.9; }
    .path-license-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .path-license-hint {
      font-size: 11px;
      color: var(--text-muted);
      width: 100%;
    }
    #paths-loading {
      text-align: center;
      color: var(--text-muted);
      padding: 32px 16px;
    }

    /* ── Card / Share button ─────────────────────────────────────────────── */
    #card-share-wrap {
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    #card-share-btn {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      padding: 7px 14px;
      cursor: pointer;
      transition: background var(--transition);
    }
    #card-share-btn:hover { background: var(--border); }

    /* ── Digest tab ─────────────────────────────────────────────────────── */
    #digest-btn {
      background: var(--accent);
      border: none;
      border-radius: 6px;
      color: var(--on-accent);
      font-size: 13px;
      font-weight: 600;
      padding: 7px 16px;
      cursor: pointer;
      transition: background var(--transition);
      display: block;
      margin-bottom: 4px;
    }
    #digest-btn:hover { background: var(--accent-dim); }
    #digest-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #digest-output {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.65;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
    }

    /* ── Un-stuck button (Paste tab) ─────────────────────────────────────── */
    #unstuck-btn {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      cursor: pointer;
      transition: background var(--transition);
    }
    #unstuck-btn:hover { background: var(--border); }
    #unstuck-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #unstuck-result {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.65;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
    }

    /* ── Footer ─────────────────────────────────────────────────────────── */
    #widget-footer {
      flex-shrink: 0;
      padding: 6px 14px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    #footer-stats { display: flex; gap: 10px; }
    #footer-milestone {
      color: var(--accent);
      font-weight: 600;
      font-size: 12px;
    }

    /* ── Global focus & input polish ────────────────────────────────────── */
    input:focus, textarea:focus { box-shadow: 0 0 0 3px var(--accent-soft); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    /* ── Respect reduced-motion ─────────────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    }
  </style>
</head>
<body>

<div id="widget">

  <!-- Header bar -->
  <div id="widget-header">
    <span id="brand-dot" aria-hidden="true"></span>
    <span id="rec-dot" title="Lumi is not capturing" style="display:none;width:8px;height:8px;border-radius:50%;background:#e5484d;margin-left:8px;box-shadow:0 0 6px #e5484d;"></span>
    <span id="header-title">Lumi <span class="tagline">&#xB7; learn as you build</span></span>
    <span id="tier-pill" title="Your current plan">Free</span>
    <button id="term-toggle-btn" type="button" title="Toggle terminal" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);cursor:pointer;font-size:11px;font-weight:600;padding:2px 8px;letter-spacing:0.04em;transition:color var(--transition),border-color var(--transition);">&#x2328; Term</button>
  </div>

  <!-- Body (hidden when collapsed) -->
  <div id="widget-body">

    <!-- Tab navigation: scrollable strip with gradient fade edges -->
    <div id="tab-nav">
      <div id="tab-bar" role="tablist" aria-label="Lumi sections">
        <button class="tab-btn active" role="tab" data-tab="lessons">Lessons</button>
        <button class="tab-btn"        role="tab" data-tab="glossary">Glossary</button>
        <button class="tab-btn"        role="tab" data-tab="review">Review</button>
        <button class="tab-btn"        role="tab" data-tab="explain">Explain</button>
        <button class="tab-btn"        role="tab" data-tab="coach">Coach</button>
        <button class="tab-btn"        role="tab" data-tab="prompt">Prompt</button>
        <button class="tab-btn"        role="tab" data-tab="paste">Paste</button>
        <button class="tab-btn"        role="tab" data-tab="paths">Paths</button>
        <button class="tab-btn"        role="tab" data-tab="digest">Digest</button>
      </div>
    </div>

    <!-- Tab content area -->
    <div id="tab-content">

      <!-- Lessons panel -->
      <div class="tab-panel active" id="panel-lessons">
        <div class="empty-state" id="lessons-empty">
          <div class="empty-dot" aria-hidden="true"></div>
          Lumi is watching &#x2014; new concepts will appear here.
        </div>
        <div id="lessons-list"></div>
      </div>

      <!-- Glossary panel -->
      <div class="tab-panel" id="panel-glossary">
        <div class="empty-state" id="glossary-loading">
          <span class="spinner"></span> Loading glossary&hellip;
        </div>
        <div id="glossary-main" style="display:none">
          <div id="glossary-head"></div>
          <input id="glossary-search" type="search" autocomplete="off"
                 placeholder="Search terms or definitions&hellip;" aria-label="Search glossary">
          <div id="glossary-list"></div>
          <div class="empty-state" id="glossary-none" style="display:none">No terms match your search.</div>
        </div>
        <div class="empty-state" id="glossary-empty" style="display:none"></div>
      </div>

      <!-- Review panel -->
      <div class="tab-panel" id="panel-review">
        <div class="empty-state" id="review-loading">
          <span class="spinner"></span> Loading review items&hellip;
        </div>
        <div id="review-cards" style="display:none"></div>
        <div class="empty-state" id="review-empty" style="display:none">
          All caught up &#x1F389;
        </div>
      </div>

      <!-- Explain panel -->
      <div class="tab-panel" id="panel-explain">
        <form id="explain-form" onsubmit="return false;">
          <input id="explain-input" type="text" placeholder="e.g. git rebase, Docker layer&hellip;" autocomplete="off">
          <button id="explain-btn" type="submit">Ask</button>
        </form>
        <div id="explain-result"></div>
      </div>

      <!-- Coach panel (lumi next) -->
      <div class="tab-panel" id="panel-coach">
        <p id="coach-heading">Ask Lumi what you should build or learn next, based on your progress.</p>
        <button id="coach-btn" type="button">What should I build next?</button>
        <div id="coach-status"></div>
        <pre id="coach-result" style="display:none"></pre>
      </div>

      <!-- Prompt tab (lumi prompt) -->
      <div class="tab-panel" id="panel-prompt">
        <p id="prompt-heading">Paste a rough idea and Lumi will rewrite it into a clear, structured prompt you can paste into any AI coding tool.</p>
        <textarea id="prompt-textarea" placeholder="e.g. make a todo list app that saves to a file&hellip;" rows="4"></textarea>
        <div id="prompt-hint"></div>
        <button id="prompt-polish-btn" type="button">Polish my prompt</button>
        <div id="prompt-output-wrap">
          <pre id="prompt-output"></pre>
          <button id="prompt-copy-btn" type="button">Copy</button>
        </div>
      </div>

      <!-- Paste panel -->
      <div class="tab-panel" id="panel-paste">
        <p id="paste-heading">Paste what your AI builder (Lovable, Bolt, v0, Replit) just generated and Lumi will extract lessons for you.</p>
        <textarea id="paste-textarea" placeholder="Paste AI output here&hellip;" rows="5"></textarea>
        <div id="paste-hint"></div>
        <button id="paste-btn" type="button">Teach me this</button>
        <div id="paste-result"></div>
        <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">
          <button id="unstuck-btn" type="button">I'm stuck &mdash; what now?</button>
          <div id="unstuck-result" style="display:none;margin-top:10px;"></div>
        </div>
      </div>

      <!-- Paths panel -->
      <div class="tab-panel" id="panel-paths">
        <div id="card-share-wrap">
          <button id="card-share-btn" type="button">Share your progress</button>
        </div>
        <div id="paths-loading">
          <span class="spinner"></span> Loading paths&hellip;
        </div>
        <div id="paths-list" style="display:none"></div>
        <div class="empty-state" id="paths-empty" style="display:none">No paths found.</div>
      </div>

      <!-- Digest panel -->
      <div class="tab-panel" id="panel-digest">
        <button id="digest-btn" type="button">This week</button>
        <div id="digest-status" style="display:none;margin-top:10px;"></div>
        <pre id="digest-output" style="display:none;margin-top:10px;"></pre>
      </div>

    </div><!-- #tab-content -->

    <!-- Terminal panel (collapsible, hidden by default) -->
    <section id="term-panel" style="display:none;border-top:1px solid var(--border,#3a2f28);flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px;">
        <strong>Lumi Terminal</strong>
        <span id="term-rec" style="display:none;color:#e5484d;">&#x25CF; recording output</span>
        <span id="term-unavail" style="display:none;opacity:.7;">native terminal module not installed</span>
        <button id="term-close" type="button" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;line-height:1;padding:2px 6px;">&#xD7;</button>
      </div>
      <div id="term-mount" style="height:240px;background:#000;"></div>
    </section>

    <!-- Footer -->
    <div id="widget-footer">
      <div id="footer-stats">
        <span id="footer-count">Learned 0</span>
        <span>&#xB7;</span>
        <span id="footer-level">Level &mdash;</span>
        <span id="footer-streak"></span>
      </div>
      <div id="footer-milestone" style="display:none"></div>
    </div>

  </div><!-- #widget-body -->
</div><!-- #widget -->

<script>
(function () {
  'use strict';

  /* ── Security helper ─────────────────────────────────────────────────── */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /* ── DOM refs ────────────────────────────────────────────────────────── */
  var tabBar       = document.getElementById('tab-bar');
  var tabNav       = document.getElementById('tab-nav');
  var tabBtns      = document.querySelectorAll('.tab-btn');
  var tabPanels    = document.querySelectorAll('.tab-panel');

  var lessonsList  = document.getElementById('lessons-list');
  var lessonsEmpty = document.getElementById('lessons-empty');

  var glossaryLoading = document.getElementById('glossary-loading');
  var glossaryMain    = document.getElementById('glossary-main');
  var glossaryHead    = document.getElementById('glossary-head');
  var glossarySearch  = document.getElementById('glossary-search');
  var glossaryList    = document.getElementById('glossary-list');
  var glossaryNone    = document.getElementById('glossary-none');
  var glossaryEmpty   = document.getElementById('glossary-empty');

  var reviewLoading = document.getElementById('review-loading');
  var reviewCards   = document.getElementById('review-cards');
  var reviewEmpty   = document.getElementById('review-empty');

  var explainInput  = document.getElementById('explain-input');
  var explainBtn    = document.getElementById('explain-btn');
  var explainResult = document.getElementById('explain-result');

  var footerCount     = document.getElementById('footer-count');
  var footerLevel     = document.getElementById('footer-level');
  var footerStreak    = document.getElementById('footer-streak');
  var footerMilestone = document.getElementById('footer-milestone');

  /* ── State ───────────────────────────────────────────────────────────── */
  var activeTab       = 'lessons';
  var glossaryLoaded  = false;
  var reviewLoaded    = false;

  /* ── Tabs ────────────────────────────────────────────────────────────
     9 sections live in a horizontally scrollable strip. The strip:
       - translates vertical wheel into horizontal scroll,
       - shows gradient fade edges when more tabs exist off-screen,
       - auto-scrolls the active tab into view,
       - supports left/right arrow navigation (roving tabindex),
       - and remembers the last active tab in localStorage. */
  var pathsLoaded  = false;
  var digestLoaded = false;
  var TAB_KEY    = 'lumi.activeTab';
  var VALID_TABS = ['lessons', 'glossary', 'review', 'explain', 'coach',
                    'prompt', 'paste', 'paths', 'digest'];

  function updateTabFades() {
    if (!tabBar || !tabNav) return;
    var max = tabBar.scrollWidth - tabBar.clientWidth;
    tabNav.classList.toggle('fade-left',  tabBar.scrollLeft > 2);
    tabNav.classList.toggle('fade-right', tabBar.scrollLeft < max - 2);
  }

  function activateTab(name) {
    if (VALID_TABS.indexOf(name) < 0) name = 'lessons';
    activeTab = name;
    var activeBtn = null;
    tabBtns.forEach(function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on) activeBtn = b;
    });
    tabPanels.forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    if (activeBtn && activeBtn.scrollIntoView) {
      activeBtn.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
    try { localStorage.setItem(TAB_KEY, name); } catch (_) { /* private mode */ }
    if (name === 'glossary' && !glossaryLoaded) loadGlossary();
    if (name === 'review'   && !reviewLoaded)   loadReview();
    if (name === 'paths'    && !pathsLoaded)    loadPaths();
    if (name === 'digest'   && !digestLoaded)   loadDigest();
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.dataset.tab); });
  });

  /* Keyboard: left/right arrows move between tabs */
  tabBar.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    var idx = VALID_TABS.indexOf(activeTab);
    if (idx < 0) idx = 0;
    idx += (e.key === 'ArrowRight') ? 1 : -1;
    if (idx < 0) idx = VALID_TABS.length - 1;
    if (idx >= VALID_TABS.length) idx = 0;
    activateTab(VALID_TABS[idx]);
    var next = tabBar.querySelector('.tab-btn[data-tab="' + VALID_TABS[idx] + '"]');
    if (next) next.focus();
  });

  /* Vertical wheel scrolls the strip horizontally */
  tabBar.addEventListener('wheel', function (e) {
    var max = tabBar.scrollWidth - tabBar.clientWidth;
    if (max <= 0) return;
    var delta = e.deltaY + e.deltaX;
    if (delta === 0) return;
    e.preventDefault();
    tabBar.scrollLeft += delta;
  }, { passive: false });

  tabBar.addEventListener('scroll', updateTabFades);
  window.addEventListener('resize', updateTabFades);

  /* Restore the last active tab (default: lessons) */
  var savedTab = null;
  try { savedTab = localStorage.getItem(TAB_KEY); } catch (_) { /* private mode */ }
  activateTab(savedTab || 'lessons');
  updateTabFades();

  /* ── Quick-check prompt helper (mirrors core/src/quickcheck.ts) ────────
     Inlined here because OVERLAY_HTML is a self-contained string — it cannot
     import modules.  The wording must stay in sync with quickCheckPrompt().  */
  function quickCheckPrompt(label) {
    return 'Before the answer — what do you think “' + label + '” means? Take a guess, then reveal.';
  }

  /* ── Dismissed lessons (persisted so SSE replay cannot resurrect them) ──
     Lessons are transient feed items. We remember which ones the user has
     dismissed in localStorage, keyed by a stable lesson id, so a re-render or
     an SSE replay on reconnect never brings a dismissed card back. */
  var DISMISSED_KEY = 'lumi.dismissedLessons';
  var dismissedLessons = (function () {
    try {
      var raw = localStorage.getItem(DISMISSED_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (_) { return {}; }
  })();
  function saveDismissed() {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedLessons)); } catch (_) { /* private mode */ }
  }
  function lessonIdOf(data) {
    if (data && data.id) return String(data.id);
    if (data && data.concept) return 'concept:' + String(data.concept);
    if (data && data.lesson && data.lesson.title) return 'title:' + String(data.lesson.title);
    return null;
  }
  function isLessonDismissed(id) { return !!(id && dismissedLessons[id]); }
  function markLessonDismissed(id) {
    if (!id) return;
    dismissedLessons[id] = 1;
    saveDismissed();
  }

  /* ── Lesson card builder ─────────────────────────────────────────────── */
  function buildLessonCard(lesson, id) {
    // lesson is a FeedLesson or Lesson object.
    // ALL dynamic text is set via textContent — never innerHTML.
    var card = document.createElement('div');
    card.className = 'card lesson-card';
    if (id) card.dataset.lessonId = id;

    // Header row: collapse/expand toggle (title + chevron) + dismiss.
    var head = document.createElement('div');
    head.className = 'lesson-head';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'lesson-toggle';
    toggle.setAttribute('aria-expanded', 'true');

    var check = document.createElement('span');
    check.className = 'lesson-check';
    check.textContent = '✓';
    check.setAttribute('aria-hidden', 'true');
    toggle.appendChild(check);

    var titleEl = document.createElement('span');
    titleEl.className = 'lesson-title';
    titleEl.textContent = lesson.title || '';
    toggle.appendChild(titleEl);

    var chevron = document.createElement('span');
    chevron.className = 'lesson-chevron';
    chevron.textContent = '▾';
    chevron.setAttribute('aria-hidden', 'true');
    toggle.appendChild(chevron);
    head.appendChild(toggle);

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'lesson-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss lesson');
    dismiss.textContent = '✕';
    head.appendChild(dismiss);
    card.appendChild(head);

    // Collapsible region (animated via grid rows). Inner wrapper is clipped.
    var collapse = document.createElement('div');
    collapse.className = 'lesson-collapse';
    var collapseInner = document.createElement('div');
    collapseInner.className = 'lesson-collapse-inner';
    var bodyPad = document.createElement('div');
    bodyPad.className = 'lesson-body-pad';
    collapseInner.appendChild(bodyPad);
    collapse.appendChild(collapseInner);
    card.appendChild(collapse);

    // Quick-check Socratic prompt (visible before reveal)
    var qcPrompt = document.createElement('p');
    qcPrompt.className = 'qc-prompt';
    qcPrompt.textContent = quickCheckPrompt(lesson.title || '');
    bodyPad.appendChild(qcPrompt);

    // Reveal button
    var revealBtn = document.createElement('button');
    revealBtn.type = 'button';
    revealBtn.className = 'qc-reveal-btn';
    revealBtn.textContent = 'Reveal answer';
    bodyPad.appendChild(revealBtn);

    // Hidden answer body — shown when Reveal is clicked
    var body = document.createElement('div');
    body.className = 'qc-body';

    // Plain explanation
    var explanationEl = document.createElement('div');
    explanationEl.className = 'card-body';
    explanationEl.textContent = lesson.plainExplanation || '';
    body.appendChild(explanationEl);

    if (lesson.whyItMatters) {
      var whySection = document.createElement('div');
      whySection.className = 'card-section';
      var whyLabel = document.createElement('span');
      whyLabel.className = 'card-label';
      whyLabel.textContent = 'Why it matters';
      var whyP = document.createElement('p');
      whyP.textContent = lesson.whyItMatters;
      whySection.appendChild(whyLabel);
      whySection.appendChild(whyP);
      body.appendChild(whySection);
    }

    if (lesson.analogy) {
      var analogySection = document.createElement('div');
      analogySection.className = 'card-section muted';
      var analogyLabel = document.createElement('span');
      analogyLabel.className = 'card-label';
      analogyLabel.textContent = 'Analogy';
      var analogyP = document.createElement('p');
      analogyP.textContent = lesson.analogy;
      analogySection.appendChild(analogyLabel);
      analogySection.appendChild(analogyP);
      body.appendChild(analogySection);
    }

    if (lesson.tinyExample) {
      var exSection = document.createElement('div');
      exSection.className = 'card-section muted';
      var exLabel = document.createElement('span');
      exLabel.className = 'card-label';
      exLabel.textContent = 'Example';
      var exP = document.createElement('p');
      exP.textContent = lesson.tinyExample;
      exSection.appendChild(exLabel);
      exSection.appendChild(exP);
      body.appendChild(exSection);
    }

    // "Got it ✓" — collapses the card and marks it understood (after reveal).
    var gotItBtn = document.createElement('button');
    gotItBtn.type = 'button';
    gotItBtn.className = 'lesson-gotit';
    gotItBtn.textContent = 'Got it ✓';
    gotItBtn.style.display = 'none';
    body.appendChild(gotItBtn);

    bodyPad.appendChild(body);

    /* Collapse/expand: a real <button> gives Enter/Space + focus for free. */
    function setExpanded(expanded) {
      card.classList.toggle('collapsed', !expanded);
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () {
      setExpanded(card.classList.contains('collapsed'));
    });

    /* Dismiss: remove the card and remember it so it cannot come back. */
    dismiss.addEventListener('click', function (ev) {
      ev.stopPropagation();
      markLessonDismissed(id);
      if (card.parentNode) card.parentNode.removeChild(card);
      if (lessonsList.children.length === 0) lessonsEmpty.style.display = '';
    });

    /* Reveal: show the answer body, then offer "Got it". */
    revealBtn.addEventListener('click', function () {
      body.classList.add('revealed');
      revealBtn.style.display = 'none';
      qcPrompt.style.display = 'none';
      gotItBtn.style.display = '';
    });

    /* Got it: collapse + visually mark as understood. */
    gotItBtn.addEventListener('click', function () {
      card.classList.add('understood');
      setExpanded(false);
    });

    return card;
  }

  /* ── Command-failure card (terminal events) ──────────────────────────── */
  function buildFailureCard(data, id) {
    var lesson = data.lesson || {};
    var cmd = data.command || {};
    var card = document.createElement('div');
    card.className = 'card failure-card';
    if (id) card.dataset.lessonId = id;

    var head = document.createElement('div');
    head.className = 'failure-head';
    var badge = document.createElement('span');
    badge.className = 'failure-badge';
    badge.textContent = '⚠ Command failed';
    head.appendChild(badge);
    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'failure-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '✕';
    head.appendChild(dismiss);
    card.appendChild(head);

    if (cmd.line) {
      var code = document.createElement('div');
      code.className = 'failure-cmd';
      code.textContent = cmd.line;
      card.appendChild(code);
    }

    var meta = document.createElement('div');
    var exit = document.createElement('span');
    exit.className = 'failure-exit';
    exit.textContent = 'exit code ' + (cmd.exitCode != null ? cmd.exitCode : '?');
    meta.appendChild(exit);
    if (cmd.cwd) {
      var cwd = document.createElement('span');
      cwd.className = 'failure-cwd';
      cwd.textContent = cmd.cwd;
      meta.appendChild(cwd);
    }
    card.appendChild(meta);

    var body = document.createElement('div');
    body.className = 'failure-body';
    var p = document.createElement('p');
    p.textContent = lesson.plainExplanation || '';
    body.appendChild(p);
    if (lesson.whyItMatters) {
      var why = document.createElement('p');
      why.className = 'failure-why';
      why.textContent = lesson.whyItMatters;
      body.appendChild(why);
    }
    card.appendChild(body);

    dismiss.addEventListener('click', function () {
      markLessonDismissed(id);
      if (card.parentNode) card.parentNode.removeChild(card);
      if (lessonsList.children.length === 0) lessonsEmpty.style.display = '';
    });

    return card;
  }

  /* ── Fix-loop (stuck) card ──────────────────────────────────────────── */
  function buildStuckCard(stuck, id) {
    var card = document.createElement('div');
    card.className = 'card failure-card';
    if (id) card.dataset.lessonId = id;

    var head = document.createElement('div');
    head.className = 'failure-head';
    var badge = document.createElement('span');
    badge.className = 'failure-badge';
    badge.textContent = '⚠ You may be stuck in a fix-loop';
    head.appendChild(badge);
    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'failure-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '✕';
    head.appendChild(dismiss);
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'failure-body';
    var p = document.createElement('p');
    p.textContent = stuck.advice || '';
    body.appendChild(p);
    card.appendChild(body);

    dismiss.addEventListener('click', function () {
      markLessonDismissed(id);
      if (card.parentNode) card.parentNode.removeChild(card);
      if (lessonsList.children.length === 0) lessonsEmpty.style.display = '';
    });

    return card;
  }

  /* ── Recording indicator — polls /api/capture-status every 5 s ─────── */
  function refreshRecDot() {
    fetch('/api/capture-status').then(function (r) { return r.json(); }).then(function (s) {
      var dot = document.getElementById('rec-dot');
      if (!dot) return;
      if (s && s.recording) {
        dot.style.display = 'inline-block';
        dot.title = 'Lumi is capturing ' + (s.tool || 'AI session') + (s.project ? ' · ' + s.project : '');
      } else {
        dot.style.display = 'none';
        dot.title = 'Lumi is not capturing';
      }
    }).catch(function () { /* server not ready */ });
  }
  refreshRecDot();
  setInterval(refreshRecDot, 5000);

  /* ── SSE: Lessons tab ────────────────────────────────────────────────── */
  var es = new EventSource('/events');

  es.onmessage = function (e) {
    try {
      var data = JSON.parse(e.data);
      // Terminal command failures render as a distinct warning card (no Socratic reveal).
      if (data && data.type === 'terminal' && data.command) {
        var fid = lessonIdOf(data);
        if (isLessonDismissed(fid)) return;
        lessonsEmpty.style.display = 'none';
        lessonsList.insertBefore(buildFailureCard(data, fid), lessonsList.firstChild);
        fetchProgress();
        return;
      }
      if (data && data.type === 'stuck' && data.stuck) {
        var sid = lessonIdOf(data);
        if (isLessonDismissed(sid)) return;
        lessonsEmpty.style.display = 'none';
        lessonsList.insertBefore(buildStuckCard(data.stuck, sid), lessonsList.firstChild);
        return;
      }
      if (data && data.lesson && data.lesson.title) {
        var id = lessonIdOf(data);
        if (isLessonDismissed(id)) return; // user dismissed this one — stay gone
        lessonsEmpty.style.display = 'none';
        var card = buildLessonCard(data.lesson, id);
        lessonsList.insertBefore(card, lessonsList.firstChild);
        fetchProgress();
      }
    } catch (_) { /* ignore malformed SSE frames */ }
  };

  es.onerror = function () {
    // Reconnection is handled automatically by the browser EventSource.
    // We do not close the connection to allow automatic reconnect.
  };

  /* ── Progress ────────────────────────────────────────────────────────── */
  function fetchProgress() {
    fetch('/api/progress')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        footerCount.textContent = 'Learned ' + String(data.count);
        footerLevel.textContent = 'Level ' + data.level;
        if (data.streakDays > 0) {
          footerStreak.textContent = '🔥 ' + data.streakDays + '-day streak';
        } else {
          footerStreak.textContent = '';
        }
        if (data.milestone) {
          footerMilestone.textContent = data.milestone;
          footerMilestone.style.display = '';
        } else if (data.nextMilestone && data.nextMilestone.remaining > 0) {
          var nm = data.nextMilestone;
          footerMilestone.textContent = '🎯 ' + nm.remaining + ' more concept' +
            (nm.remaining === 1 ? '' : 's') + ' to reach ' + nm.reward;
          footerMilestone.style.display = '';
        } else {
          footerMilestone.style.display = 'none';
        }
      })
      .catch(function () { /* progress fetch is best-effort */ });
  }

  fetchProgress();

  /* ── Glossary tab — interactive, searchable, collapsible ──────────────── */
  var glossaryEntries = [];

  function loadGlossary() {
    glossaryLoaded = true;
    glossaryLoading.style.display = '';
    glossaryMain.style.display = 'none';
    glossaryEmpty.style.display = 'none';

    fetch('/api/glossary')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        glossaryLoading.style.display = 'none';
        glossaryEntries = Array.isArray(data.entries) ? data.entries : [];
        renderGlossaryView();
      })
      .catch(function () {
        glossaryLoading.style.display = 'none';
        glossaryEmpty.textContent = 'Could not load glossary.';
        glossaryEmpty.style.display = '';
      });
  }

  function renderGlossaryView() {
    var n = glossaryEntries.length;
    if (n === 0) {
      glossaryMain.style.display = 'none';
      glossaryEmpty.textContent =
        "No terms yet — concepts appear here as Lumi teaches you while you build.";
      glossaryEmpty.style.display = '';
      return;
    }
    glossaryEmpty.style.display = 'none';
    glossaryMain.style.display = '';
    glossaryHead.textContent =
      "You've learned " + n + (n === 1 ? ' concept.' : ' concepts.');
    applyGlossaryFilter();
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function applyGlossaryFilter() {
    var q = (glossarySearch.value || '').trim().toLowerCase();
    var matches = glossaryEntries.filter(function (e) {
      if (!q) return true;
      var hay = (
        (e.label || '') + ' ' + (e.definition || '') + ' ' + (e.analogy || '')
      ).toLowerCase();
      return hay.indexOf(q) >= 0;
    });

    clearChildren(glossaryList);

    if (matches.length === 0) {
      glossaryNone.style.display = '';
      return;
    }
    glossaryNone.style.display = 'none';

    // Group consecutive entries by category (the array is pre-sorted server-side).
    var groups = [];
    var byCat = {};
    matches.forEach(function (e) {
      var key = e.category || 'other';
      if (!byCat[key]) {
        byCat[key] = { category: key, label: e.categoryLabel || key, items: [] };
        groups.push(byCat[key]);
      }
      byCat[key].items.push(e);
    });

    groups.forEach(function (g) {
      glossaryList.appendChild(buildCategorySection(g));
    });
  }

  function buildCategorySection(group) {
    var section = document.createElement('div');
    section.className = 'gloss-cat';

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'gloss-cat-head';
    head.setAttribute('aria-expanded', 'true');

    var chev = document.createElement('span');
    chev.className = 'gloss-chevron';
    chev.textContent = '▾';
    chev.setAttribute('aria-hidden', 'true');
    head.appendChild(chev);

    var label = document.createElement('span');
    label.className = 'gloss-cat-label';
    label.textContent = group.label;
    head.appendChild(label);

    var count = document.createElement('span');
    count.className = 'gloss-cat-count';
    count.textContent = String(group.items.length);
    head.appendChild(count);
    section.appendChild(head);

    var body = document.createElement('div');
    body.className = 'gloss-cat-body';
    var inner = document.createElement('div');
    inner.className = 'gloss-cat-inner';
    body.appendChild(inner);
    section.appendChild(body);

    group.items.forEach(function (entry) {
      inner.appendChild(buildGlossaryRow(entry));
    });

    head.addEventListener('click', function () {
      var collapsed = section.classList.toggle('collapsed');
      head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });

    return section;
  }

  function buildGlossaryRow(entry) {
    var row = document.createElement('div');
    row.className = 'gloss-row';

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'gloss-term';
    head.setAttribute('aria-expanded', 'false');

    var term = document.createElement('span');
    term.className = 'gloss-term-label';
    term.textContent = entry.label || entry.id || '';
    head.appendChild(term);

    var chev = document.createElement('span');
    chev.className = 'gloss-row-chevron';
    chev.textContent = '▾';
    chev.setAttribute('aria-hidden', 'true');
    head.appendChild(chev);
    row.appendChild(head);

    // Collapsible detail (definition + analogy + meta + learn-more).
    var detail = document.createElement('div');
    detail.className = 'gloss-detail';
    var inner = document.createElement('div');
    inner.className = 'gloss-detail-inner';
    var pad = document.createElement('div');
    pad.className = 'gloss-detail-pad';
    inner.appendChild(pad);
    detail.appendChild(inner);
    row.appendChild(detail);

    if (entry.definition) {
      var def = document.createElement('p');
      def.className = 'gloss-def';
      def.textContent = entry.definition;
      pad.appendChild(def);
    }
    if (entry.analogy) {
      var an = document.createElement('p');
      an.className = 'gloss-analogy';
      an.textContent = 'Like… ' + entry.analogy;
      pad.appendChild(an);
    }

    var meta = document.createElement('p');
    meta.className = 'gloss-meta';
    var seen = (entry.seenCount == null) ? 0 : entry.seenCount;
    meta.textContent = 'seen ' + seen + '× · learned ' + (entry.learnedAt || '—');
    pad.appendChild(meta);

    if (entry.learnMore) {
      var link = document.createElement('a');
      link.className = 'gloss-learn';
      link.href = entry.learnMore;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Learn more ↗';
      pad.appendChild(link);
    }

    head.addEventListener('click', function () {
      var open = row.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    return row;
  }

  if (glossarySearch) {
    glossarySearch.addEventListener('input', applyGlossaryFilter);
  }

  /* ── Review tab ──────────────────────────────────────────────────────── */

  /**
   * Build a single recall card DOM node for one review item.
   * All dynamic text (label, explanation) goes through escapeHtml.
   * All interactivity uses addEventListener — zero inline event handlers.
   */
  function buildRecallCard(item) {
    var card = document.createElement('div');
    card.className = 'recall-card';

    // Prompt
    var prompt = document.createElement('p');
    prompt.className = 'recall-prompt';
    // We build the safe HTML using a text node + strong element so we never
    // set innerHTML with dynamic content.
    var promptPrefix = document.createTextNode('Do you remember what “');
    var labelStrong  = document.createElement('strong');
    labelStrong.textContent = item.label;           // textContent escapes automatically
    var promptSuffix = document.createTextNode('” means?');
    prompt.appendChild(promptPrefix);
    prompt.appendChild(labelStrong);
    prompt.appendChild(promptSuffix);
    card.appendChild(prompt);

    // Answer area (hidden until Reveal is clicked)
    var answerEl = document.createElement('div');
    answerEl.className = 'recall-answer';
    answerEl.style.display = 'none';
    card.appendChild(answerEl);

    // Action buttons row
    var actions = document.createElement('div');
    actions.className = 'recall-actions';
    card.appendChild(actions);

    // Reveal button
    var btnReveal = document.createElement('button');
    btnReveal.className = 'recall-btn recall-btn-reveal';
    btnReveal.textContent = 'Reveal answer';
    actions.appendChild(btnReveal);

    // Remembered / Fuzzy buttons (hidden until answer is revealed)
    var btnRemembered = document.createElement('button');
    btnRemembered.className = 'recall-btn recall-btn-remembered';
    btnRemembered.textContent = 'Remembered ✅';
    btnRemembered.style.display = 'none';
    actions.appendChild(btnRemembered);

    var btnFuzzy = document.createElement('button');
    btnFuzzy.className = 'recall-btn recall-btn-fuzzy';
    btnFuzzy.textContent = 'Still fuzzy 🤔';
    btnFuzzy.style.display = 'none';
    actions.appendChild(btnFuzzy);

    /* Reveal answer handler */
    btnReveal.addEventListener('click', function () {
      btnReveal.disabled = true;
      answerEl.textContent = 'Loading…';
      answerEl.style.display = '';

      fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: item.label }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var explanation =
            (data.lesson && data.lesson.plainExplanation)
              ? data.lesson.plainExplanation
              : null;
          // textContent handles escaping — no innerHTML with dynamic content
          answerEl.textContent = explanation !== null
            ? explanation
            : '(no saved explanation)';
          // Surface the analogy too — at reveal time it's the memory hook that
          // makes a concept stick.
          if (data.lesson && data.lesson.analogy) {
            var an = document.createElement('div');
            an.className = 'recall-analogy';
            an.textContent = 'Think of it like: ' + data.lesson.analogy;
            answerEl.appendChild(an);
          }
          btnReveal.style.display   = 'none';
          btnRemembered.style.display = '';
          btnFuzzy.style.display      = '';
        })
        .catch(function () {
          answerEl.textContent = 'Could not load explanation. Please try again.';
          btnReveal.disabled = false;
        });
    });

    /* Shared handler that records the answer and marks the card done */
    function recordAnswer(remembered) {
      btnRemembered.disabled = true;
      btnFuzzy.disabled      = true;

      fetch('/api/review/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptId: item.id, remembered: remembered }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            // Replace action buttons with a done message
            actions.innerHTML = '';
            var doneMsg = document.createElement('span');
            doneMsg.className = 'recall-done-msg';
            doneMsg.textContent = remembered
              ? '✓ got it — well done!'
              : "we’ll revisit this soon";
            actions.appendChild(doneMsg);
            card.classList.add('done');
            fetchProgress();   // refresh footer progress
          } else {
            // Server responded but not ok — re-enable for retry
            btnRemembered.disabled = false;
            btnFuzzy.disabled      = false;
          }
        })
        .catch(function () {
          btnRemembered.disabled = false;
          btnFuzzy.disabled      = false;
        });
    }

    btnRemembered.addEventListener('click', function () { recordAnswer(true);  });
    btnFuzzy.addEventListener('click',      function () { recordAnswer(false); });

    return card;
  }

  function loadReview() {
    reviewLoaded = true;
    reviewLoading.style.display = '';
    reviewCards.style.display   = 'none';
    reviewEmpty.style.display   = 'none';

    fetch('/api/review')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        reviewLoading.style.display = 'none';
        var items = Array.isArray(data.items) ? data.items : [];
        if (items.length === 0) {
          reviewEmpty.style.display = '';
        } else {
          // Clear any previous render then append a card per item
          reviewCards.innerHTML = '';
          items.forEach(function (item) {
            reviewCards.appendChild(buildRecallCard(item));
          });
          reviewCards.style.display = '';
        }
      })
      .catch(function () {
        reviewLoading.style.display = 'none';
        reviewEmpty.textContent = 'Could not load review items.';
        reviewEmpty.style.display = '';
      });
  }

  /* ── Explain tab ──────────────────────────────────────────────────────── */
  explainBtn.addEventListener('click', function () {
    var term = explainInput.value.trim();
    if (!term) return;

    explainBtn.disabled = true;
    explainResult.innerHTML = '<div class="empty-state"><span class="spinner"></span> Thinking&hellip;</div>';

    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: term }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        explainBtn.disabled = false;
        if (!data.lesson) {
          explainResult.innerHTML =
            '<div class="empty-state">I don&#39;t have a lesson for that yet.</div>';
          return;
        }
        explainResult.innerHTML = '';
        explainResult.appendChild(buildLessonCard(data.lesson));
      })
      .catch(function () {
        explainBtn.disabled = false;
        explainResult.innerHTML =
          '<div class="empty-state">Something went wrong. Please try again.</div>';
      });
  });

  /* Allow pressing Enter in the input to submit */
  explainInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') explainBtn.click();
  });

  /* ── Coach tab (lumi next) ───────────────────────────────────────────── */
  var coachBtn    = document.getElementById('coach-btn');
  var coachStatus = document.getElementById('coach-status');
  var coachResult = document.getElementById('coach-result');

  coachBtn.addEventListener('click', function () {
    coachBtn.disabled = true;
    coachResult.style.display = 'none';
    coachStatus.innerHTML = '<div class="empty-state"><span class="spinner"></span> Thinking&hellip;</div>';

    fetch('/api/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        coachBtn.disabled = false;
        coachStatus.innerHTML = '';
        if (data.advice) {
          // textContent handles escaping — no innerHTML with dynamic content
          coachResult.textContent = data.advice;
          coachResult.style.display = '';
        } else {
          coachStatus.innerHTML = '<div class="empty-state">No advice available right now. Try again soon.</div>';
        }
      })
      .catch(function () {
        coachBtn.disabled = false;
        coachStatus.innerHTML = '<div class="empty-state">Something went wrong. Please try again.</div>';
      });
  });

  /* ── Prompt tab (lumi prompt) ────────────────────────────────────────── */
  var promptTextarea  = document.getElementById('prompt-textarea');
  var promptHint      = document.getElementById('prompt-hint');
  var promptPolishBtn = document.getElementById('prompt-polish-btn');
  var promptOutputWrap = document.getElementById('prompt-output-wrap');
  var promptOutput    = document.getElementById('prompt-output');
  var promptCopyBtn   = document.getElementById('prompt-copy-btn');

  promptPolishBtn.addEventListener('click', function () {
    var idea = promptTextarea.value.trim();
    if (!idea) {
      promptHint.textContent = 'Type an idea first.';
      return;
    }
    promptHint.textContent = '';
    promptPolishBtn.disabled = true;
    promptOutputWrap.style.display = 'none';
    promptHint.innerHTML = '<span class="spinner"></span> Polishing&hellip;';

    fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: idea }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        promptPolishBtn.disabled = false;
        promptHint.innerHTML = '';
        if (data.prompt) {
          // textContent handles escaping — no innerHTML with dynamic content
          promptOutput.textContent = data.prompt;
          promptOutputWrap.style.display = '';
        } else if (data.error) {
          promptHint.textContent = 'Error: ' + data.error;
        } else {
          promptHint.textContent = 'No output returned. Please try again.';
        }
      })
      .catch(function () {
        promptPolishBtn.disabled = false;
        promptHint.textContent = 'Something went wrong. Please try again.';
      });
  });

  promptCopyBtn.addEventListener('click', function () {
    var text = promptOutput.textContent || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        promptCopyBtn.textContent = 'Copied!';
        setTimeout(function () { promptCopyBtn.textContent = 'Copy'; }, 2000);
      }).catch(function () {
        promptCopyBtn.textContent = 'Copy failed';
        setTimeout(function () { promptCopyBtn.textContent = 'Copy'; }, 2000);
      });
    } else {
      // Graceful fallback: select the text in the pre element
      try {
        var range = document.createRange();
        range.selectNodeContents(promptOutput);
        var sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        promptCopyBtn.textContent = 'Selected (Ctrl+C to copy)';
        setTimeout(function () { promptCopyBtn.textContent = 'Copy'; }, 3000);
      } catch (_) {
        promptCopyBtn.textContent = 'Copy unavailable';
        setTimeout(function () { promptCopyBtn.textContent = 'Copy'; }, 2000);
      }
    }
  });

  /* ── Paste tab (web AI builder output) ──────────────────────────────── */
  var pasteTextarea = document.getElementById('paste-textarea');
  var pasteHint     = document.getElementById('paste-hint');
  var pasteBtn      = document.getElementById('paste-btn');
  var pasteResult   = document.getElementById('paste-result');

  pasteBtn.addEventListener('click', function () {
    var text = pasteTextarea.value.trim();
    if (!text) {
      pasteHint.textContent = 'Paste something first.';
      return;
    }
    pasteHint.textContent = '';
    pasteResult.textContent = '';
    pasteBtn.disabled = true;
    pasteHint.innerHTML = '<span class="spinner"></span> Analysing&hellip;';

    fetch('/api/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        pasteBtn.disabled = false;
        pasteHint.textContent = '';
        if (typeof data.count === 'number') {
          if (data.count === 0) {
            pasteResult.textContent = 'Nothing new spotted — you may already know these concepts, or try more detailed output.';
          } else {
            pasteResult.textContent = '✨ ' + data.count + ' new lesson' + (data.count === 1 ? '' : 's') + ' added — see the Lessons tab.';
            fetchProgress();
          }
          // Security lens: flag risky patterns in the pasted code, right here.
          if (data.risks && data.risks.length) {
            var box = document.createElement('div');
            box.className = 'paste-risks';
            var head = document.createElement('p');
            head.className = 'paste-risks-head';
            head.textContent = '🔍 ' + data.risks.length + ' security issue' + (data.risks.length === 1 ? '' : 's') + ' spotted in that code:';
            box.appendChild(head);
            data.risks.forEach(function (risk) {
              var item = document.createElement('div');
              item.className = 'paste-risk paste-risk-' + risk.severity;
              var label = document.createElement('div');
              label.className = 'paste-risk-label';
              label.textContent = (risk.severity === 'high' ? '🚨 ' : '⚠️ ') + risk.label + ' (' + risk.severity + ')';
              var advice = document.createElement('div');
              advice.className = 'paste-risk-advice';
              advice.textContent = risk.advice;
              item.appendChild(label);
              item.appendChild(advice);
              box.appendChild(item);
            });
            pasteResult.appendChild(box);
          }
        } else if (data.error) {
          pasteHint.textContent = 'Error: ' + data.error;
        } else {
          pasteHint.textContent = 'Unexpected response. Please try again.';
        }
      })
      .catch(function () {
        pasteBtn.disabled = false;
        pasteHint.textContent = 'Something went wrong. Please try again.';
      });
  });

  /* ── Tier pill ───────────────────────────────────────────────────────── */
  var tierPill = document.getElementById('tier-pill');

  function fetchEntitlement() {
    fetch('/api/entitlement')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !tierPill) return;
        var tier = String(data.tier || 'free');
        tierPill.textContent = tier === 'pro' ? 'Pro' : 'Free';
        if (tier === 'pro') {
          tierPill.classList.add('pro');
        } else {
          tierPill.classList.remove('pro');
        }
      })
      .catch(function () { /* best-effort */ });
  }

  fetchEntitlement();

  /* ── Paths tab ───────────────────────────────────────────────────────── */
  var pathsLoading = document.getElementById('paths-loading');
  var pathsList    = document.getElementById('paths-list');
  var pathsEmpty   = document.getElementById('paths-empty');

  function buildPathCard(path) {
    var card = document.createElement('div');
    card.className = path.locked ? 'path-card locked' : 'path-card';

    var titleEl = document.createElement('div');
    titleEl.className = 'path-title';
    titleEl.textContent = (path.locked ? '🔒 ' : '') + (path.title || path.pathId);
    card.appendChild(titleEl);

    if (path.locked) {
      // Locked path: show upgrade banner instead of progress bar
      var banner = document.createElement('div');
      banner.className = 'path-locked-banner';

      var bannerText = document.createTextNode('Pro — unlock all paths. ');
      banner.appendChild(bannerText);

      var upgradeLink = document.createElement('a');
      upgradeLink.className = 'path-upgrade-link';
      upgradeLink.textContent = 'Upgrade';
      upgradeLink.href = 'https://lumi.dev/pro';
      upgradeLink.target = '_blank';
      upgradeLink.rel = 'noopener noreferrer';
      banner.appendChild(upgradeLink);

      var orText = document.createTextNode(' or ');
      banner.appendChild(orText);

      var pasteLink = document.createElement('button');
      pasteLink.className = 'path-upgrade-link';
      pasteLink.style.background = 'none';
      pasteLink.style.border = 'none';
      pasteLink.style.padding = '0';
      pasteLink.style.cursor = 'pointer';
      pasteLink.textContent = 'paste a license key';
      banner.appendChild(pasteLink);

      card.appendChild(banner);

      // Inline license form (hidden until "paste a license key" is clicked)
      var licenseForm = document.createElement('div');
      licenseForm.className = 'path-license-form';

      var licenseInput = document.createElement('input');
      licenseInput.className = 'path-license-input';
      licenseInput.type = 'text';
      licenseInput.placeholder = 'Paste your license key…';
      licenseForm.appendChild(licenseInput);

      var licenseBtn = document.createElement('button');
      licenseBtn.className = 'path-license-btn';
      licenseBtn.textContent = 'Activate';
      licenseForm.appendChild(licenseBtn);

      var licenseHint = document.createElement('div');
      licenseHint.className = 'path-license-hint';
      licenseForm.appendChild(licenseHint);

      card.appendChild(licenseForm);

      pasteLink.addEventListener('click', function () {
        licenseForm.classList.add('visible');
        licenseInput.focus();
      });

      licenseBtn.addEventListener('click', function () {
        var key = licenseInput.value.trim();
        if (!key) {
          licenseHint.textContent = 'Please enter a license key.';
          return;
        }
        licenseBtn.disabled = true;
        licenseHint.textContent = 'Activating…';

        fetch('/api/license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: key }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.ok) {
              licenseHint.textContent = 'License activated! Reloading…';
              fetchEntitlement();
              // Reload paths to reflect new entitlement
              pathsLoaded = false;
              loadPaths();
            } else {
              licenseHint.textContent = data.reason || 'Invalid license key. Please try again.';
              licenseBtn.disabled = false;
            }
          })
          .catch(function () {
            licenseHint.textContent = 'Could not activate. Please try again.';
            licenseBtn.disabled = false;
          });
      });

    } else {
      // Unlocked path: show progress bar
      var barWrap = document.createElement('div');
      barWrap.className = 'path-bar-wrap';
      var barFill = document.createElement('div');
      barFill.className = 'path-bar-fill';
      barFill.style.width = Math.min(100, Math.max(0, path.pct || 0)).toFixed(1) + '%';
      barWrap.appendChild(barFill);
      card.appendChild(barWrap);

      var meta = document.createElement('div');
      meta.className = 'path-meta';
      var leftSpan = document.createElement('span');
      leftSpan.textContent = String(path.done) + ' / ' + String(path.total) + ' concepts';
      var rightSpan = document.createElement('span');
      rightSpan.textContent = (path.pct || 0).toFixed(0) + '%';
      meta.appendChild(leftSpan);
      meta.appendChild(rightSpan);
      card.appendChild(meta);

      if (path.nextLabel) {
        var nextEl = document.createElement('div');
        nextEl.className = 'path-next';
        nextEl.textContent = 'Next: ' + path.nextLabel;
        card.appendChild(nextEl);
      }
    }

    return card;
  }

  function loadPaths() {
    pathsLoaded = true;
    pathsLoading.style.display = '';
    pathsList.style.display = 'none';
    pathsEmpty.style.display = 'none';

    fetch('/api/paths')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        pathsLoading.style.display = 'none';
        var items = Array.isArray(data.paths) ? data.paths : [];
        if (items.length === 0) {
          pathsEmpty.style.display = '';
        } else {
          pathsList.innerHTML = '';
          items.forEach(function (path) {
            pathsList.appendChild(buildPathCard(path));
          });
          pathsList.style.display = '';
        }
      })
      .catch(function () {
        pathsLoading.style.display = 'none';
        pathsEmpty.textContent = 'Could not load learning paths.';
        pathsEmpty.style.display = '';
      });
  }

  /* ── Card: Share your progress ───────────────────────────────────────── */
  var cardShareBtn = document.getElementById('card-share-btn');

  cardShareBtn.addEventListener('click', function () {
    window.open('/api/card', '_blank');
  });

  /* ── Digest tab ──────────────────────────────────────────────────────── */
  var digestBtn    = document.getElementById('digest-btn');
  var digestStatus = document.getElementById('digest-status');
  var digestOutput = document.getElementById('digest-output');

  function loadDigest() {
    digestLoaded = true;
    digestBtn.disabled = true;
    digestOutput.style.display = 'none';
    digestStatus.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading&hellip;</div>';
    digestStatus.style.display = '';

    fetch('/api/digest')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        digestBtn.disabled = false;
        digestStatus.style.display = 'none';
        // textContent — never innerHTML with dynamic content
        digestOutput.textContent = data.text || '(no digest yet)';
        digestOutput.style.display = '';
      })
      .catch(function () {
        digestBtn.disabled = false;
        digestStatus.style.display = 'none';
        digestOutput.textContent = 'Could not load digest. Please try again.';
        digestOutput.style.display = '';
      });
  }

  digestBtn.addEventListener('click', function () {
    loadDigest();
  });

  /* ── Un-stuck button (Paste tab) ─────────────────────────────────────── */
  var unstuckBtn    = document.getElementById('unstuck-btn');
  var unstuckResult = document.getElementById('unstuck-result');

  unstuckBtn.addEventListener('click', function () {
    var text = pasteTextarea.value.trim();
    if (!text) {
      unstuckResult.textContent = 'Paste something first.';
      unstuckResult.style.display = '';
      return;
    }
    unstuckBtn.disabled = true;
    unstuckResult.style.display = 'none';

    fetch('/api/unstuck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        unstuckBtn.disabled = false;
        // textContent — never innerHTML with dynamic content
        unstuckResult.textContent = data.advice || '(no advice)';
        unstuckResult.style.display = '';
      })
      .catch(function () {
        unstuckBtn.disabled = false;
        unstuckResult.textContent = 'Something went wrong. Please try again.';
        unstuckResult.style.display = '';
      });
  });

  /* ── Terminal panel (lazy xterm.js load over /term WebSocket) ───────── */
  var termInited = false;
  function initTerminal() {
    if (termInited) return; termInited = true;
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/vendor/xterm.css';
    document.head.appendChild(css);
    fetch('/api/terminal/status').then(function (r) { return r.json(); }).then(function (st) {
      if (!st || !st.available) { document.getElementById('term-unavail').style.display = ''; return; }
      var s = document.createElement('script'); s.src = '/vendor/xterm.js';
      s.onload = function () {
        // Load the fit addon next; it's optional, so open even if it fails.
        var f = document.createElement('script'); f.src = '/vendor/addon-fit.js';
        f.onload = function () { openTerminal(); };
        f.onerror = function () { openTerminal(); };
        document.head.appendChild(f);
      };
      s.onerror = function () { document.getElementById('term-unavail').style.display = ''; };
      document.head.appendChild(s);
    }).catch(function () { document.getElementById('term-unavail').style.display = ''; });
  }
  function refreshTermRec() {
    fetch('/api/consent').then(function (r) { return r.json(); }).then(function (c) {
      var on = !!(c && c.enabled && c.tools && c.tools['lumi-terminal'] === true && (!c.scopes || c.scopes.output !== false));
      var rec = document.getElementById('term-rec');
      if (!rec) return;
      rec.textContent = on ? '● recording output' : 'display only — capture off';
      rec.style.color = on ? '#e5484d' : '';
      rec.style.opacity = on ? '1' : '0.7';
      rec.style.display = '';
    }).catch(function () {});
  }
  var lumiFit = null;
  function openTerminal() {
    var TermCtor = window.Terminal; if (!TermCtor) { document.getElementById('term-unavail').style.display = ''; return; }
    var term = new TermCtor({ convertEol: true, fontSize: 12, theme: { background: '#000' } });
    var FitCtor = window.FitAddon && window.FitAddon.FitAddon;
    lumiFit = FitCtor ? new FitCtor() : null;
    if (lumiFit) { try { term.loadAddon(lumiFit); } catch (e) { lumiFit = null; } }
    term.open(document.getElementById('term-mount'));
    if (lumiFit) { try { lumiFit.fit(); } catch (e) {} }
    window.addEventListener('resize', function () { if (lumiFit) { try { lumiFit.fit(); } catch (e) {} } });
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    var ws = new WebSocket(proto + '://' + location.host + '/term');
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'output') term.write(m.data);
      else if (m.type === 'exit') term.write('\r\n[lumi] shell exited (' + m.exitCode + ')\r\n');
      else if (m.type === 'unavailable') { document.getElementById('term-unavail').style.display = ''; }
    };
    var termRecTimer = null;
    ws.onopen = function () { refreshTermRec(); termRecTimer = setInterval(refreshTermRec, 5000); };
    ws.onclose = function () {
      if (termRecTimer) { clearInterval(termRecTimer); termRecTimer = null; }
      var rec = document.getElementById('term-rec'); if (rec) rec.style.display = 'none';
    };
    term.onData(function (d) { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'input', data: d })); });
    term.onResize(function (sz) { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'resize', cols: sz.cols, rows: sz.rows })); });
  }

  var termToggleBtn = document.getElementById('term-toggle-btn');
  var termPanel     = document.getElementById('term-panel');
  var termCloseBtn  = document.getElementById('term-close');

  if (termToggleBtn) {
    termToggleBtn.addEventListener('click', function () {
      if (!termPanel) return;
      // Panel starts with inline display:none; any non-'none' value means shown.
      var isShown = termPanel.style.display !== 'none';
      termPanel.style.display = isShown ? 'none' : '';
      if (!isShown) {
        initTerminal();
        // Re-fit when re-opening: the panel may have resized while hidden.
        if (lumiFit) { try { lumiFit.fit(); } catch (e) {} }
      }
    });
  }
  if (termCloseBtn) {
    termCloseBtn.addEventListener('click', function () {
      // Hiding only collapses the panel; the WS/shell session stays alive so
      // re-opening rejoins the same session (intentional).
      if (termPanel) termPanel.style.display = 'none';
    });
  }

})();
</script>

</body>
</html>`;
