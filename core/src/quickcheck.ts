/**
 * Active-recall quick-check helpers.
 *
 * These are pure functions — no DOM, no I/O — so they can be unit-tested in
 * isolation and reused in any surface (overlay, VS Code panel, CLI hint, etc.).
 *
 * The strings produced here are set via element.textContent, never innerHTML,
 * so no HTML-escaping is required in this module.
 */

/**
 * Return a Socratic one-liner that primes the learner to guess before they
 * read the full explanation.
 *
 * @param label  The concept name exactly as it will appear in the card title.
 *               The caller is responsible for ensuring it is a human-readable
 *               string; this function does not transform it.
 * @returns      A non-empty prompt string safe to assign to element.textContent.
 */
export function quickCheckPrompt(label: string): string {
  return `Before the answer — what do you think "${label}" means? Take a guess, then reveal.`;
}
