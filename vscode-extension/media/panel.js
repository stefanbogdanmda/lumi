const vscode = acquireVsCodeApi();

const cards = document.getElementById("cards");
const glossaryEl = document.getElementById("glossary");
const reviewEl = document.getElementById("review");
const reviewEmpty = document.getElementById("reviewEmpty");
const explainInput = document.getElementById("explainInput");
const explainBtn = document.getElementById("explainBtn");
const explainResult = document.getElementById("explainResult");
const count = document.getElementById("count");
const level = document.getElementById("level");
const milestone = document.getElementById("milestone");
const collapseToggle = document.getElementById("collapseToggle");
const tierPill = document.getElementById("tierPill");

// Coach
const coachBtn = document.getElementById("coachBtn");
const coachStatus = document.getElementById("coachStatus");
const coachResult = document.getElementById("coachResult");

// Prompt
const promptTextarea = document.getElementById("promptTextarea");
const promptHint = document.getElementById("promptHint");
const promptPolishBtn = document.getElementById("promptPolishBtn");
const promptOutputWrap = document.getElementById("promptOutputWrap");
const promptOutput = document.getElementById("promptOutput");
const promptCopyBtn = document.getElementById("promptCopyBtn");

// Paste
const pasteTextarea = document.getElementById("pasteTextarea");
const pasteHint = document.getElementById("pasteHint");
const pasteBtn = document.getElementById("pasteBtn");
const pasteResult = document.getElementById("pasteResult");

// Paths
const pathsLoading = document.getElementById("pathsLoading");
const pathsList = document.getElementById("pathsList");
const pathsEmpty = document.getElementById("pathsEmpty");

// Digest
const digestBtn = document.getElementById("digestBtn");
const digestOutput = document.getElementById("digestOutput");

let activeTab = "lessons";
// Tabs that fetch fresh data from the extension when activated.
const loaded = { glossary: false, review: false, paths: false };

// ----- collapse / expand -----
collapseToggle.addEventListener("click", () => {
  const collapsed = document.body.classList.toggle("collapsed");
  collapseToggle.textContent = collapsed ? "▸" : "▾";
});

// ----- hero "Get started" -----
const heroStart = document.getElementById("heroStart");
if (heroStart) {
  heroStart.addEventListener("click", () => {
    const firstTab = document.querySelector('.tab[data-tab="lessons"]');
    if (firstTab) firstTab.click();
    document.getElementById("welcomeHero")?.classList.add("collapsed");
  });
}

// ----- tabs -----
function activateTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((p) =>
    p.hidden = p.dataset.panel !== tab);
  if (tab === "glossary" && !loaded.glossary) {
    vscode.postMessage({ type: "requestGlossary" });
  } else if (tab === "review" && !loaded.review) {
    vscode.postMessage({ type: "requestReview" });
  } else if (tab === "paths" && !loaded.paths) {
    loaded.paths = true;
    vscode.postMessage({ type: "requestPaths" });
  }
}

// Request entitlement on startup for the tier pill
vscode.postMessage({ type: "requestEntitlement" });
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => activateTab(b.dataset.tab)));
activateTab(activeTab);

// ----- explain -----
function sendExplain() {
  const term = explainInput.value.trim();
  if (!term) return;
  vscode.postMessage({ type: "explain", term });
}
explainBtn.addEventListener("click", sendExplain);
explainInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendExplain(); });

// ----- coach -----
coachBtn.addEventListener("click", () => {
  coachBtn.disabled = true;
  coachResult.hidden = true;
  coachStatus.textContent = "Thinking…";
  vscode.postMessage({ type: "requestNext" });
});

// ----- prompt polisher -----
promptPolishBtn.addEventListener("click", () => {
  const idea = promptTextarea.value.trim();
  if (!idea) {
    promptHint.textContent = "Type an idea first.";
    return;
  }
  promptHint.textContent = "Polishing…";
  promptPolishBtn.disabled = true;
  promptOutputWrap.hidden = true;
  vscode.postMessage({ type: "polishPrompt", idea });
});

promptCopyBtn.addEventListener("click", () => {
  const text = promptOutput.textContent || "";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      promptCopyBtn.textContent = "Copied!";
      setTimeout(() => { promptCopyBtn.textContent = "Copy"; }, 2000);
    }).catch(() => {
      promptCopyBtn.textContent = "Copy failed";
      setTimeout(() => { promptCopyBtn.textContent = "Copy"; }, 2000);
    });
  } else {
    // Fallback: select the text
    try {
      const range = document.createRange();
      range.selectNodeContents(promptOutput);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      promptCopyBtn.textContent = "Selected (Ctrl+C to copy)";
      setTimeout(() => { promptCopyBtn.textContent = "Copy"; }, 3000);
    } catch (_) {
      promptCopyBtn.textContent = "Copy unavailable";
      setTimeout(() => { promptCopyBtn.textContent = "Copy"; }, 2000);
    }
  }
});

// ----- paste -----
pasteBtn.addEventListener("click", () => {
  const text = pasteTextarea.value.trim();
  if (!text) {
    pasteHint.textContent = "Paste something first.";
    return;
  }
  pasteHint.textContent = "Analysing…";
  pasteResult.textContent = "";
  pasteBtn.disabled = true;
  vscode.postMessage({ type: "paste", text });
});

// ----- digest -----
digestBtn.addEventListener("click", () => {
  digestBtn.disabled = true;
  digestOutput.hidden = true;
  vscode.postMessage({ type: "requestDigest" });
});

// ----- shared escaped card renderer (used by Lessons + Explain) -----
// Implements active-recall quick-check: shows a Socratic prompt + Reveal button
// before the explanation body, mirroring the overlay's quickCheckPrompt pattern.
function quickCheckPrompt(label) {
  return 'Before the answer — what do you think "' + label + '" means? Take a guess, then reveal.';
}

function buildCard(lesson) {
  const div = document.createElement("div");
  div.className = "card";

  // Title
  const h3 = document.createElement("h3");
  h3.textContent = lesson.title;
  div.appendChild(h3);

  // Quick-check Socratic prompt (visible before reveal)
  const qcPrompt = document.createElement("p");
  qcPrompt.className = "qc-prompt";
  qcPrompt.textContent = quickCheckPrompt(lesson.title || "");
  div.appendChild(qcPrompt);

  // Reveal button
  const revealBtn = document.createElement("button");
  revealBtn.className = "qc-reveal-btn";
  revealBtn.textContent = "Reveal answer";
  div.appendChild(revealBtn);

  // Hidden body shown after reveal
  const body = document.createElement("div");
  body.className = "qc-body";

  const explanationEl = document.createElement("div");
  explanationEl.textContent = lesson.plainExplanation;
  body.appendChild(explanationEl);

  if (lesson.whyItMatters) {
    const why = document.createElement("div");
    why.className = "why";
    why.textContent = "Why it matters: " + lesson.whyItMatters;
    body.appendChild(why);
  }
  if (lesson.analogy) {
    const analogy = document.createElement("div");
    analogy.className = "analogy";
    analogy.textContent = lesson.analogy;
    body.appendChild(analogy);
  }
  if (lesson.tinyExample) {
    const example = document.createElement("div");
    example.className = "example";
    example.textContent = lesson.tinyExample;
    body.appendChild(example);
  }

  // Actions (gotit / fuzzy) inside hidden body so they appear after reveal
  const actions = document.createElement("div");
  actions.className = "actions";
  const okBtn = document.createElement("button");
  okBtn.className = "ok";
  okBtn.textContent = "Makes sense ✅";
  const fuzzyBtn = document.createElement("button");
  fuzzyBtn.className = "fuzzy";
  fuzzyBtn.textContent = "Still fuzzy 🤔";
  actions.appendChild(okBtn);
  actions.appendChild(fuzzyBtn);
  body.appendChild(actions);

  div.appendChild(body);

  // Reveal handler
  revealBtn.addEventListener("click", () => {
    body.classList.add("revealed");
    revealBtn.style.display = "none";
    qcPrompt.style.display = "none";
  });

  okBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "gotit", conceptId: lesson.conceptId });
    div.style.opacity = "0.5";
  });
  fuzzyBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "fuzzy", conceptId: lesson.conceptId });
    fuzzyBtn.textContent = "I'll explain again later 👍";
  });

  return div;
}

// ----- paths card builder -----
function buildPathCard(path) {
  const card = document.createElement("div");
  card.className = path.locked ? "path-card locked" : "path-card";

  const titleEl = document.createElement("div");
  titleEl.className = "path-title";
  titleEl.textContent = (path.locked ? "🔒 " : "") + (path.title || path.pathId);
  card.appendChild(titleEl);

  if (path.locked) {
    // Locked: show upgrade banner
    const banner = document.createElement("div");
    banner.className = "path-locked-banner";

    const bannerText = document.createTextNode("Pro — unlock all paths. ");
    banner.appendChild(bannerText);

    const upgradeLink = document.createElement("a");
    upgradeLink.className = "path-upgrade-link";
    upgradeLink.textContent = "Upgrade";
    upgradeLink.href = "https://lumi.dev/pro";
    upgradeLink.target = "_blank";
    upgradeLink.rel = "noopener noreferrer";
    banner.appendChild(upgradeLink);

    const orText = document.createTextNode(" or ");
    banner.appendChild(orText);

    const pasteBtn = document.createElement("button");
    pasteBtn.className = "path-upgrade-btn";
    pasteBtn.textContent = "paste a license key";
    banner.appendChild(pasteBtn);

    card.appendChild(banner);

    // Inline license form
    const licenseForm = document.createElement("div");
    licenseForm.className = "path-license-form";

    const licenseInput = document.createElement("input");
    licenseInput.className = "path-license-input";
    licenseInput.type = "text";
    licenseInput.placeholder = "Paste your license key…";
    licenseForm.appendChild(licenseInput);

    const activateBtn = document.createElement("button");
    activateBtn.className = "path-license-activate-btn";
    activateBtn.textContent = "Activate";
    licenseForm.appendChild(activateBtn);

    const hint = document.createElement("div");
    hint.className = "path-license-hint";
    licenseForm.appendChild(hint);

    card.appendChild(licenseForm);

    pasteBtn.addEventListener("click", () => {
      licenseForm.classList.add("visible");
      licenseInput.focus();
    });

    activateBtn.addEventListener("click", () => {
      const key = licenseInput.value.trim();
      if (!key) {
        hint.textContent = "Please enter a license key.";
        return;
      }
      activateBtn.disabled = true;
      hint.textContent = "Activating…";
      vscode.postMessage({ type: "activateLicense", key });
      // Response handled in the message listener below; store ref for later
      card.dataset.pendingActivation = "1";
      licenseForm.dataset.hintId = hint.id = "license-hint-" + Math.random().toString(36).slice(2);
    });

  } else {
    // Unlocked: show progress bar
    const barWrap = document.createElement("div");
    barWrap.className = "path-bar-wrap";
    const barFill = document.createElement("div");
    barFill.className = "path-bar-fill";
    barFill.style.width = Math.min(100, Math.max(0, path.pct || 0)).toFixed(1) + "%";
    barWrap.appendChild(barFill);
    card.appendChild(barWrap);

    const meta = document.createElement("div");
    meta.className = "path-meta";
    const leftSpan = document.createElement("span");
    leftSpan.textContent = String(path.done) + " / " + String(path.total) + " concepts";
    const rightSpan = document.createElement("span");
    rightSpan.textContent = (path.pct || 0).toFixed(0) + "%";
    meta.appendChild(leftSpan);
    meta.appendChild(rightSpan);
    card.appendChild(meta);

    if (path.nextLabel) {
      const nextEl = document.createElement("div");
      nextEl.className = "path-next";
      nextEl.textContent = "Next: " + path.nextLabel;
      card.appendChild(nextEl);
    }
  }

  return card;
}

// ----- incoming messages from the extension -----
window.addEventListener("message", (e) => {
  const msg = e.data;

  if (msg.type === "lesson") {
    const empty = cards.querySelector(".empty");
    if (empty) empty.remove();
    cards.prepend(buildCard(msg.lesson));

  } else if (msg.type === "glossary") {
    loaded.glossary = true;
    glossaryEl.textContent = "";
    const pre = document.createElement("pre");
    pre.className = "glossary-text";
    pre.textContent = String(msg.markdown);
    glossaryEl.appendChild(pre);

  } else if (msg.type === "review") {
    loaded.review = true;
    reviewEl.textContent = "";
    const items = Array.isArray(msg.items) ? msg.items : [];
    if (items.length === 0) {
      reviewEmpty.textContent = "All caught up 🎉";
      reviewEmpty.hidden = false;
    } else {
      reviewEmpty.hidden = true;
      for (const item of items) {
        const li = document.createElement("li");
        li.textContent = item.label;
        reviewEl.appendChild(li);
      }
    }

  } else if (msg.type === "explainResult") {
    explainResult.textContent = "";
    if (msg.lesson) {
      explainResult.appendChild(buildCard(msg.lesson));
    } else {
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = "I don't have a lesson for that yet";
      explainResult.appendChild(div);
    }

  } else if (msg.type === "nextResult") {
    coachBtn.disabled = false;
    coachStatus.textContent = "";
    coachResult.textContent = String(msg.text);
    coachResult.hidden = false;

  } else if (msg.type === "promptResult") {
    promptPolishBtn.disabled = false;
    promptHint.textContent = "";
    promptOutput.textContent = String(msg.text);
    promptOutputWrap.hidden = false;

  } else if (msg.type === "pasteResult") {
    pasteBtn.disabled = false;
    pasteHint.textContent = "";
    if (msg.error) {
      pasteResult.textContent = msg.error;
    } else if (typeof msg.count === "number") {
      if (msg.count === 0) {
        pasteResult.textContent = "Nothing new spotted — you may already know these concepts, or try more detailed output.";
      } else {
        pasteResult.textContent = "✨ " + msg.count + " new lesson" + (msg.count === 1 ? "" : "s") + " — see Lessons tab.";
      }
      // Security lens: flag risky patterns in the pasted code.
      if (Array.isArray(msg.risks) && msg.risks.length) {
        const box = document.createElement("div");
        box.className = "paste-risks";
        const head = document.createElement("p");
        head.className = "paste-risks-head";
        head.textContent = "🔍 " + msg.risks.length + " security issue" + (msg.risks.length === 1 ? "" : "s") + " spotted in that code:";
        box.appendChild(head);
        msg.risks.forEach((risk) => {
          const item = document.createElement("div");
          item.className = "paste-risk paste-risk-" + risk.severity;
          const label = document.createElement("div");
          label.className = "paste-risk-label";
          label.textContent = (risk.severity === "high" ? "🚨 " : "⚠️ ") + risk.label + " (" + risk.severity + ")";
          const advice = document.createElement("div");
          advice.className = "paste-risk-advice";
          advice.textContent = risk.advice;
          item.appendChild(label);
          item.appendChild(advice);
          box.appendChild(item);
        });
        pasteResult.appendChild(box);
      }
    }

  } else if (msg.type === "paths") {
    pathsLoading.hidden = true;
    const items = Array.isArray(msg.paths) ? msg.paths : [];
    if (msg.error || items.length === 0) {
      pathsEmpty.textContent = msg.error || "No paths found.";
      pathsEmpty.hidden = false;
    } else {
      pathsList.textContent = "";
      for (const path of items) {
        pathsList.appendChild(buildPathCard(path));
      }
      pathsList.hidden = false;
    }

  } else if (msg.type === "digest") {
    digestBtn.disabled = false;
    digestOutput.textContent = String(msg.text);
    digestOutput.hidden = false;

  } else if (msg.type === "progress") {
    count.textContent = String(msg.count);
    level.textContent = String(msg.level);
    if (msg.milestone) {
      milestone.textContent = msg.milestone;
      milestone.hidden = false;
    } else {
      milestone.hidden = true;
    }
    // Progress changed: glossary/review data is now stale. Invalidate the
    // lazy-load caches so the next visit refetches, and refresh live if open.
    loaded.glossary = false;
    loaded.review = false;
    loaded.paths = false;
    if (activeTab === "glossary") { vscode.postMessage({ type: "requestGlossary" }); loaded.glossary = true; }
    if (activeTab === "review") { vscode.postMessage({ type: "requestReview" }); loaded.review = true; }
    if (activeTab === "paths") { loaded.paths = true; vscode.postMessage({ type: "requestPaths" }); }

  } else if (msg.type === "entitlement") {
    if (tierPill) {
      const tier = String(msg.tier || "free");
      tierPill.textContent = tier === "pro" ? "Pro" : "Free";
      if (tier === "pro") {
        tierPill.classList.add("pro");
      } else {
        tierPill.classList.remove("pro");
      }
    }

  } else if (msg.type === "licenseResult") {
    if (msg.ok) {
      // Refresh entitlement pill and paths now that we are Pro
      vscode.postMessage({ type: "requestEntitlement" });
      loaded.paths = false;
      if (activeTab === "paths") {
        loaded.paths = true;
        vscode.postMessage({ type: "requestPaths" });
      }
    } else {
      // Surface the error in any pending activation hint
      const hint = document.getElementById(
        document.querySelector(".path-license-form.visible [id^='license-hint-']")?.id || ""
      );
      if (hint) {
        hint.textContent = msg.reason || "Invalid license key. Please try again.";
        const btn = hint.closest(".path-license-form")?.querySelector(".path-license-activate-btn");
        if (btn) btn.disabled = false;
      }
    }
  }
});

// Ask for the initial footer state.
vscode.postMessage({ type: "requestProgress" });

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
