/**
 * Self-contained HTML document for the Lumi web overlay (roadmap 10.2).
 *
 * Design notes:
 *  - No external resources; all style and script are inline.
 *  - CSP allows only 'unsafe-inline' styles/scripts and 'self' for fetch/SSE.
 *  - Always-on-top behaviour is set by the OS window manager or the Electron/Tauri
 *    shell that hosts this page; the browser itself does not expose that API.
 *  - escapeHtml() is the single guard for every dynamic string.
 */

export const OVERLAY_HTML: string = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lumi Overlay</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #1e1e2e;
      --surface: #27273a;
      --surface2: #313147;
      --border: #3d3d5c;
      --accent: #a78bfa;
      --accent-dim: #7c5cbf;
      --text: #e2e2f0;
      --text-muted: #8888aa;
      --green: #4ade80;
      --radius: 12px;
      --shadow: 0 8px 32px rgba(0,0,0,0.55);
      --header-h: 44px;
      --tab-h: 36px;
      --transition: 0.18s ease;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f5f3ff;
        --surface: #ffffff;
        --surface2: #ede9fe;
        --border: #c4b5fd;
        --accent: #7c3aed;
        --accent-dim: #5b21b6;
        --text: #1e1b4b;
        --text-muted: #6b7280;
        --shadow: 0 8px 32px rgba(100,80,200,0.18);
      }
    }

    html, body {
      height: 100%;
      background: transparent;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: var(--text);
    }

    /* ── Floating widget shell ─────────────────────────────────────────── */
    #widget {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 420px;
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: width var(--transition);
    }
    #widget.wide {
      width: 620px;
    }
    #widget.collapsed #widget-body {
      display: none;
    }

    /* ── Header ────────────────────────────────────────────────────────── */
    #widget-header {
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--header-h);
      padding: 0 12px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      user-select: none;
      -webkit-app-region: drag; /* lets the header drag the frameless native (Tauri) window; ignored in a browser */
    }
    #header-title {
      flex: 1;
      font-weight: 700;
      font-size: 15px;
      color: var(--accent);
      letter-spacing: 0.01em;
    }
    .chrome-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface2);
      color: var(--text-muted);
      cursor: pointer;
      -webkit-app-region: no-drag; /* keep chrome buttons clickable inside the draggable header */
      font-size: 13px;
      line-height: 1;
      transition: background var(--transition), color var(--transition);
    }
    .chrome-btn:hover {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    /* ── Body ──────────────────────────────────────────────────────────── */
    #widget-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* ── Tabs ──────────────────────────────────────────────────────────── */
    #tab-bar {
      display: flex;
      height: var(--tab-h);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      overflow-x: auto;
      flex-wrap: nowrap;
      /* Hide scrollbar on WebKit / Blink while keeping momentum scroll */
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: var(--border) transparent;
    }
    #tab-bar::-webkit-scrollbar {
      height: 3px;
    }
    #tab-bar::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 2px;
    }
    #tab-bar::-webkit-scrollbar-track {
      background: transparent;
    }
    .tab-btn {
      flex: 0 0 auto;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: color var(--transition), border-color var(--transition);
      padding: 0 10px;
      white-space: nowrap;
    }
    .tab-btn:hover {
      color: var(--text);
    }
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    /* ── Tab panels ────────────────────────────────────────────────────── */
    #tab-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

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

    /* ── Empty / loading states ─────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 32px 16px;
      line-height: 1.6;
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

    /* ── Glossary ───────────────────────────────────────────────────────── */
    #glossary-pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text);
    }

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
      color: #fff;
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
      color: #fff;
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
      color: #fff;
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
      color: #fff;
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
      color: #fff;
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
      -webkit-app-region: no-drag;
    }
    #tier-pill.pro {
      background: var(--accent);
      color: #fff;
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
      color: #fff;
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
      color: #fff;
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
  </style>
</head>
<body>

<div id="widget">

  <!-- Header bar -->
  <div id="widget-header">
    <span id="header-title">&#x1FA84; Lumi</span>
    <span id="tier-pill" title="Your current plan">Free</span>
    <button class="chrome-btn" id="btn-wide"    title="Toggle wide mode">&#x2194;</button>
    <button class="chrome-btn" id="btn-collapse" title="Collapse / expand">&#x2212;</button>
  </div>

  <!-- Body (hidden when collapsed) -->
  <div id="widget-body">

    <!-- Tab bar -->
    <div id="tab-bar">
      <button class="tab-btn active" data-tab="lessons">Lessons</button>
      <button class="tab-btn"        data-tab="glossary">Glossary</button>
      <button class="tab-btn"        data-tab="review">Review</button>
      <button class="tab-btn"        data-tab="explain">Explain</button>
      <button class="tab-btn"        data-tab="coach">Coach</button>
      <button class="tab-btn"        data-tab="prompt">Prompt</button>
      <button class="tab-btn"        data-tab="paste">Paste</button>
      <button class="tab-btn"        data-tab="paths">Paths</button>
      <button class="tab-btn"        data-tab="digest">Digest</button>
    </div>

    <!-- Tab content area -->
    <div id="tab-content">

      <!-- Lessons panel -->
      <div class="tab-panel active" id="panel-lessons">
        <div class="empty-state" id="lessons-empty">
          Lumi is watching &#x2014; new concepts will appear here.
        </div>
        <div id="lessons-list"></div>
      </div>

      <!-- Glossary panel -->
      <div class="tab-panel" id="panel-glossary">
        <div class="empty-state" id="glossary-loading">
          <span class="spinner"></span> Loading glossary&hellip;
        </div>
        <pre id="glossary-pre" style="display:none"></pre>
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
  var widget       = document.getElementById('widget');
  var btnWide      = document.getElementById('btn-wide');
  var btnCollapse  = document.getElementById('btn-collapse');
  var tabBtns      = document.querySelectorAll('.tab-btn');
  var tabPanels    = document.querySelectorAll('.tab-panel');

  var lessonsList  = document.getElementById('lessons-list');
  var lessonsEmpty = document.getElementById('lessons-empty');

  var glossaryLoading = document.getElementById('glossary-loading');
  var glossaryPre     = document.getElementById('glossary-pre');

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

  /* ── Chrome: collapse / wide ─────────────────────────────────────────── */
  btnCollapse.addEventListener('click', function () {
    var collapsed = widget.classList.toggle('collapsed');
    btnCollapse.innerHTML = collapsed ? '&#x2B;' : '&#x2212;';
    btnCollapse.title = collapsed ? 'Expand' : 'Collapse';
  });

  btnWide.addEventListener('click', function () {
    widget.classList.toggle('wide');
  });

  /* ── Tabs ────────────────────────────────────────────────────────────── */
  var pathsLoaded  = false;
  var digestLoaded = false;

  function activateTab(name) {
    activeTab = name;
    tabBtns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    tabPanels.forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    if (name === 'glossary' && !glossaryLoaded) loadGlossary();
    if (name === 'review'   && !reviewLoaded)   loadReview();
    if (name === 'paths'    && !pathsLoaded)    loadPaths();
    if (name === 'digest'   && !digestLoaded)   loadDigest();
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activateTab(btn.dataset.tab);
    });
  });

  /* ── Quick-check prompt helper (mirrors core/src/quickcheck.ts) ────────
     Inlined here because OVERLAY_HTML is a self-contained string — it cannot
     import modules.  The wording must stay in sync with quickCheckPrompt().  */
  function quickCheckPrompt(label) {
    return 'Before the answer — what do you think “' + label + '” means? Take a guess, then reveal.';
  }

  /* ── Lesson card builder ─────────────────────────────────────────────── */
  function buildLessonCard(lesson) {
    // lesson is a FeedLesson or Lesson object.
    // ALL dynamic text is set via textContent — never innerHTML.
    var card = document.createElement('div');
    card.className = 'card';

    // Title (always visible)
    var titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = lesson.title || '';
    card.appendChild(titleEl);

    // Quick-check Socratic prompt (always visible before reveal)
    var qcPrompt = document.createElement('p');
    qcPrompt.className = 'qc-prompt';
    qcPrompt.textContent = quickCheckPrompt(lesson.title || '');
    card.appendChild(qcPrompt);

    // Reveal button
    var revealBtn = document.createElement('button');
    revealBtn.className = 'qc-reveal-btn';
    revealBtn.textContent = 'Reveal answer';
    card.appendChild(revealBtn);

    // Hidden body — shown when Reveal is clicked
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

    card.appendChild(body);

    // Reveal click handler — shows body, hides prompt + button
    revealBtn.addEventListener('click', function () {
      body.classList.add('revealed');
      revealBtn.style.display = 'none';
      qcPrompt.style.display = 'none';
    });

    return card;
  }

  /* ── SSE: Lessons tab ────────────────────────────────────────────────── */
  var es = new EventSource('/events');

  es.onmessage = function (e) {
    try {
      var data = JSON.parse(e.data);
      if (data && data.lesson && data.lesson.title) {
        lessonsEmpty.style.display = 'none';
        var card = buildLessonCard(data.lesson);
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
        } else {
          footerMilestone.style.display = 'none';
        }
      })
      .catch(function () { /* progress fetch is best-effort */ });
  }

  fetchProgress();

  /* ── Glossary tab ────────────────────────────────────────────────────── */
  function loadGlossary() {
    glossaryLoaded = true;
    glossaryLoading.style.display = '';
    glossaryPre.style.display = 'none';

    fetch('/api/glossary')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        glossaryLoading.style.display = 'none';
        // Render markdown as plain escaped text in a <pre>
        glossaryPre.textContent = data.markdown || '(no glossary yet)';
        glossaryPre.style.display = '';
      })
      .catch(function () {
        glossaryLoading.style.display = 'none';
        glossaryPre.textContent = 'Could not load glossary.';
        glossaryPre.style.display = '';
      });
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
            '<div class="empty-state">I don\'t have a lesson for that yet.</div>';
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

})();
</script>

</body>
</html>`;
