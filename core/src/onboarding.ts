/**
 * onboarding.ts — the first-run welcome.
 *
 * A brand-new user (empty profile) running bare `lumi` gets a warm, plain-English
 * orientation instead of a wall of command help — the moment that decides whether
 * an install becomes an active user. Also available anytime via `lumi welcome`.
 */

/** The getting-started message shown on first run and via `lumi welcome`. */
export function onboardingGuide(): string {
  return [
    "✨ Welcome to Lumi — your AI mini-teacher.",
    "",
    "Lumi rides inside the AI coding tool you already use and explains each new",
    "tech concept the moment it appears — in plain English — then remembers it,",
    "reviews it so it sticks, and warns you when the AI does something risky.",
    "",
    "Get started in three steps:",
    "  1. Connect your tools:   lumi setup --all",
    "  2. Keep building with your AI as usual — Lumi watches and teaches.",
    "  3. See your lessons:     lumi serve     (opens the web overlay)",
    "",
    "Try one right now:",
    "  lumi topics             Browse everything Lumi can teach",
    '  lumi explain "api"      Learn a concept on the spot',
    "  lumi check              Paste your AI's output to spot risky code",
    "  lumi path               See your learning path and what's next",
    "",
    "Lumi runs on your AI tool's own model — no extra login, API key, or cost.",
    "",
    "See every command:  lumi help",
  ].join("\n");
}
