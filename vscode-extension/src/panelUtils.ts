/**
 * panelUtils.ts
 *
 * Pure utility functions extracted from panelView.ts so they can be unit-tested
 * without importing the `vscode` module (which is unavailable outside the
 * VS Code runtime).
 */

/**
 * Substitute the template placeholders in the raw panel HTML.
 *
 * All arguments are plain strings so this function has zero runtime deps and
 * is trivially testable.
 */
export function buildHtml(
  rawHtml: string,
  cssUri: string,
  jsUri: string,
  cspSource: string,
  nonce: string,
): string {
  return rawHtml
    .replace("__CSS__", cssUri)
    .replace("__JS__", jsUri)
    .replaceAll("__CSP_SOURCE__", cspSource)
    .replace(/__NONCE__/g, nonce);
}

/** Generate a 32-character alphanumeric nonce for Content-Security-Policy. */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
