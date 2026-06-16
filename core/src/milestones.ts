import { levelFromCount } from "./level";

/** A friendly welcome shown on the very first lesson (empty profile). */
export function welcomeMessage(): string {
  return "👋 Welcome to Lumi! I'll explain each new tech concept the first time it appears — once each — then stay out of your way. Let's learn as you build.";
}

/** A celebration message when the learner crosses a milestone count, else null. */
export function milestoneFor(learnedCount: number): string | null {
  switch (learnedCount) {
    case 1: return "🎉 You just learned your very first concept. This is how fluency starts.";
    case 5: return "🌱 5 concepts learned — you've reached the **Growing** level. You're getting the hang of this!";
    case 15: return "🚀 15 concepts down — you now understand more than most people who use AI tools.";
    case 30: return "🏆 30 concepts! You've reached **Confident**. You genuinely understand what you're building.";
    default: return null;
  }
}

/**
 * Given the learned count BEFORE and AFTER this turn, return any message to show:
 * the welcome on the first-ever concept, then a milestone if one was crossed.
 */
export function progressMessage(prevCount: number, newCount: number): string | null {
  if (prevCount === 0 && newCount >= 1) {
    const m = milestoneFor(newCount);
    return m ? `${welcomeMessage()}\n\n${m}` : welcomeMessage();
  }
  return milestoneFor(newCount);
}

// Silence unused-import linting — levelFromCount is imported for semantic alignment
// with the level boundary documentation; the milestone counts deliberately match its thresholds.
void levelFromCount;
