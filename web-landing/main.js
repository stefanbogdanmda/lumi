// Unmute toggle for the hero video.
const video = document.querySelector(".hero-bg");
const unmute = document.getElementById("unmute");
if (video && unmute) {
  unmute.addEventListener("click", () => {
    video.muted = !video.muted;
    const on = !video.muted;
    unmute.setAttribute("aria-pressed", String(on));
    unmute.textContent = on ? "🔇 Mute" : "🔊 Sound";
    if (on) video.play().catch(() => {});
  });
}
// Scroll reveal.
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
