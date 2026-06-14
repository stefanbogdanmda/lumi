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
      `<div><button>Got it ✅</button></div>`;
    div.querySelector("button").addEventListener("click", () => {
      vscode.postMessage({ type: "gotit", conceptId: msg.lesson.conceptId });
      div.style.opacity = "0.5";
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
