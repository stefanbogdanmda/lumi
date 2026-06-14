const vscode = acquireVsCodeApi();
const cards = document.getElementById("cards");
const count = document.getElementById("count");
let learned = 0;

window.addEventListener("message", (e) => {
  const msg = e.data;
  if (msg.type === "lesson") {
    const empty = cards.querySelector(".empty");
    if (empty) empty.remove();
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML =
      `<h3>${escapeHtml(msg.lesson.title)}</h3>` +
      `<div>${escapeHtml(msg.lesson.plainExplanation)}</div>` +
      `<div class="why">Why it matters: ${escapeHtml(msg.lesson.whyItMatters)}</div>` +
      (msg.lesson.tinyExample ? `<div class="example">${escapeHtml(msg.lesson.tinyExample)}</div>` : "") +
      `<div class="actions"><button class="ok">Makes sense ✅</button> <button class="fuzzy">Still fuzzy 🤔</button></div>`;
    div.querySelector(".ok").addEventListener("click", () => {
      vscode.postMessage({ type: "gotit", conceptId: msg.lesson.conceptId });
      div.style.opacity = "0.5";
    });
    div.querySelector(".fuzzy").addEventListener("click", () => {
      vscode.postMessage({ type: "fuzzy", conceptId: msg.lesson.conceptId });
      div.querySelector(".fuzzy").textContent = "I'll explain again later 👍";
    });
    cards.prepend(div);
  } else if (msg.type === "progress") {
    learned = msg.count; count.textContent = String(learned);
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
