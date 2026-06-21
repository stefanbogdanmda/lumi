/**
 * risk.ts — Lumi Security Lens
 *
 * Detects security risks in AI-generated code/output and provides lesson framing hints.
 * Reuses detector.ts scoring infrastructure; no external dependencies.
 */

import { detectConcepts } from "./detector";
import { CONCEPTS } from "./concepts";

// ---------------------------------------------------------------------------
// Severity map — kept here so we don't need to touch types.ts (Concept is there)
// ---------------------------------------------------------------------------

type Severity = "info" | "warn" | "danger";

const SEVERITY: Record<string, Severity> = {
  // original 10
  "hardcoded-secret":           "danger",
  "secret-in-frontend":         "danger",
  "missing-auth":               "warn",
  "missing-input-validation":   "warn",
  "sql-injection-risk":         "danger",
  "env-file-exposed":           "danger",
  "plaintext-http":             "warn",
  "weak-password-storage":      "danger",
  "eval-injection":             "danger",
  "open-cors":                  "warn",
  // new 11 (Part A)
  "xss":                        "danger",
  "csrf":                       "warn",
  "path-traversal":             "danger",
  "ssrf":                       "danger",
  "idor":                       "danger",
  "insecure-deserialization":   "danger",
  "missing-rate-limit":         "warn",
  "default-credentials":        "danger",
  "sensitive-data-in-logs":     "warn",
  "mass-assignment":            "warn",
  "debug-mode-in-prod":         "warn",
  // new 7 (v1.7 deepening)
  "open-redirect":              "warn",
  "jwt-alg-none":               "danger",
  "insecure-cookie":            "warn",
  "verbose-error-exposed":      "warn",
  "cleartext-token-storage":    "warn",
  "directory-listing":          "warn",
  "ssti":                       "danger",
};

/** Ordered list of all security concept IDs (stable; used by tests and orchestrator). */
export const SECURITY_CONCEPT_IDS: string[] = Object.keys(SEVERITY);

// Severity sort order: danger=0, warn=1, info=2
const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };

// ---------------------------------------------------------------------------
// RiskHit — the value type returned by detectRisks
// ---------------------------------------------------------------------------

export interface RiskHit {
  conceptId: string;
  label: string;
  severity: Severity;
}

// Security-only slice of CONCEPTS for efficient matching
const SECURITY_CONCEPTS = CONCEPTS.filter((c) => c.category === "security");

/**
 * Detect security risks in `text` (tool output, generated code, etc.).
 *
 * Returns a deduped array of RiskHit objects sorted danger-first, then warn, then info.
 * Only security-category concepts are returned.
 */
export function detectRisks(text: string): RiskHit[] {
  const foundIds = detectConcepts(text, SECURITY_CONCEPTS);

  const hits: RiskHit[] = foundIds
    .filter((id) => SECURITY_CONCEPT_IDS.includes(id))
    .map((id) => {
      const concept = SECURITY_CONCEPTS.find((c) => c.id === id);
      const severity: Severity = SEVERITY[id] ?? "info";
      return {
        conceptId: id,
        label: concept?.label ?? id,
        severity,
      };
    });

  // Sort danger → warn → info
  hits.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return hits;
}

// ---------------------------------------------------------------------------
// Lesson hints — plain-English framing the lesson generator can prepend
// so it focuses on "why it's risky + how to fix it"
// ---------------------------------------------------------------------------

const HINTS: Record<string, string> = {
  "hardcoded-secret":
    "This code contains a hardcoded secret or API key directly in the source file. " +
    "This is a serious security risk: anyone who reads your code (or your git history) can steal that key and " +
    "misuse your account. Never put real secrets in code. Instead, store them in environment variables " +
    "(.env file, never committed) and read them with process.env.YOUR_KEY_NAME. " +
    "Explain this risk clearly and show how to fix it with an environment variable.",

  "secret-in-frontend":
    "A secret key is being exposed through a client-side environment variable prefix (like NEXT_PUBLIC_, VITE_, or REACT_APP_). " +
    "Any variable with these prefixes is bundled into the browser JavaScript that anyone can read. " +
    "Secrets such as API keys, database passwords, or private tokens should never use these prefixes. " +
    "Explain why frontend code is public, and show how to route sensitive calls through a server-side API route instead.",

  "missing-auth":
    "This route or endpoint has no authentication check, meaning anyone on the internet could access it. " +
    "Always protect sensitive routes with an auth middleware that verifies the user's identity (e.g. checks a JWT or session cookie). " +
    "Explain this risk and show a simple example of adding an auth guard.",

  "missing-input-validation":
    "User-supplied data is being processed without validation or sanitization. " +
    "Attackers can send unexpected values (very long strings, special characters, malicious scripts) to crash your app or steal data. " +
    "Always validate that input is the right type, length, and format before using it. " +
    "Explain this risk and show a simple validation example using a library like Zod or express-validator.",

  "sql-injection-risk":
    "A SQL query is built by concatenating or interpolating user input directly into the query string. " +
    "This is a classic SQL injection vulnerability: an attacker can craft input like ' OR '1'='1 to read, " +
    "modify, or delete your entire database. " +
    "Always use parameterized queries or a query builder that separates data from code. " +
    "Explain SQL injection in plain English and show the safe parameterized alternative.",

  "env-file-exposed":
    "A .env file is being committed to version control, printed to logs, or otherwise exposed. " +
    ".env files contain secrets — never commit them. Add .env to .gitignore and use .env.example " +
    "(with fake values) to document what variables are needed. " +
    "Explain why leaking a .env file is dangerous and how to fix it right now.",

  "plaintext-http":
    "An API call or connection is using http:// instead of https://. " +
    "Plain HTTP sends all data in clear text — anyone on the same network can read passwords, tokens, and user data. " +
    "Always use https:// for any non-local URL. " +
    "Explain why HTTPS matters and show how to update the URL.",

  "weak-password-storage":
    "Passwords are being stored as plain text or hashed with a weak algorithm like MD5 or SHA-1. " +
    "These are broken for passwords: MD5 can be cracked in seconds with a modern GPU. " +
    "Always use a slow, salted hashing algorithm designed for passwords — bcrypt, Argon2, or scrypt. " +
    "Explain this risk and show a minimal bcrypt example.",

  "eval-injection":
    "eval(), dangerouslySetInnerHTML, or new Function() is being used with dynamic or user-controlled input. " +
    "This turns user data into executable code — a critical vulnerability that lets attackers run arbitrary JavaScript. " +
    "Avoid eval() entirely. For HTML rendering, sanitize content with a library like DOMPurify before setting innerHTML. " +
    "Explain this risk and show a safe alternative.",

  "open-cors":
    "CORS is configured with Access-Control-Allow-Origin: *, which allows any website on the internet to make " +
    "authenticated requests to your API. This can expose user data to malicious sites. " +
    "Restrict the allowed origins to only the specific domains that should access your API. " +
    "Explain what CORS does, why wildcard origin is risky, and how to lock it down.",

  "xss":
    "Cross-site scripting (XSS) occurs when user-supplied data is rendered as HTML without escaping it first. " +
    "An attacker can inject a <script> tag that steals cookies, hijacks sessions, or redirects users. " +
    "Never set innerHTML directly with untrusted content. " +
    "Always escape HTML output or use a library like DOMPurify to sanitize it before rendering. " +
    "Explain XSS in plain English, show why innerHTML is dangerous, and demonstrate the safe alternative.",

  "csrf":
    "Cross-site request forgery (CSRF) tricks a logged-in user's browser into making an unwanted request to your server. " +
    "Without a CSRF token, a malicious site can silently submit forms or trigger actions on behalf of the user. " +
    "Protect state-changing routes (POST, PUT, DELETE) with a CSRF token that is tied to the user's session. " +
    "Explain CSRF with a concrete example and show how to add CSRF protection (e.g., the csurf middleware or SameSite cookie attribute).",

  "path-traversal":
    "A path traversal attack lets an attacker read files outside the intended directory by using sequences like ../../etc/passwd in a filename parameter. " +
    "If your code uses user input to build a file path without validation, attackers can read source code, credentials, or system files. " +
    "Always resolve the final path and confirm it starts with the expected base directory before opening the file. " +
    "Explain path traversal clearly and show a safe path-validation pattern using Node's path.resolve().",

  "ssrf":
    "Server-side request forgery (SSRF) happens when your server fetches a URL supplied by the user without restriction. " +
    "An attacker can point it at internal services (AWS metadata endpoint, database, admin panels) that are not reachable from the internet. " +
    "Validate that the target URL uses an allowed scheme and hostname before making the request. " +
    "Explain SSRF risk and show how to whitelist or validate URLs on the server side.",

  "idor":
    "Insecure direct object reference (IDOR) is a serious risk: the server returns a resource based on an ID in the request without checking that the current user actually owns it. " +
    "An attacker can simply change the ID in the URL or request body to access another user's private data. " +
    "Always verify that the authenticated user is the owner of (or is permitted to access) the requested resource before returning it. " +
    "Explain IDOR with a clear example and show how to add an ownership check to fix it.",

  "insecure-deserialization":
    "Insecure deserialization occurs when your application deserializes data from an untrusted source (e.g., a cookie, request body, or queue message) without validation. " +
    "Attackers can craft malicious payloads that, when deserialized, execute arbitrary code or tamper with application logic. " +
    "Never deserialize data from untrusted sources with powerful serializers (like Python's pickle). " +
    "Prefer safe, schema-validated formats like JSON with strict type checking, and always validate the structure before use. " +
    "Explain this risk and show a safe deserialization alternative.",

  "missing-rate-limit":
    "Without rate limiting, attackers can send unlimited requests to login, signup, or sensitive API endpoints. " +
    "This enables brute-force password attacks, credential stuffing, account enumeration, and denial-of-service. " +
    "Add rate limiting to all authentication and sensitive endpoints (e.g., using express-rate-limit or a similar library). " +
    "Explain the risk, show how brute-force works, and demonstrate adding a rate limiter in a few lines of code.",

  "default-credentials":
    "Default credentials (like admin/admin, root/root, or a vendor-supplied initial password) are publicly known and the first thing attackers try. " +
    "Leaving them unchanged gives an attacker instant access to your database, admin panel, or server. " +
    "Always change all default passwords immediately after setup and enforce strong, unique credentials. " +
    "Explain why default credentials are dangerous and walk through the steps to change them safely.",

  "sensitive-data-in-logs":
    "Logging passwords, tokens, API keys, or PII (like emails or credit card numbers) exposes them to anyone who can read the log files — " +
    "including third-party logging services, junior developers, and attackers who gain log access. " +
    "Never log credentials or sensitive fields. Redact or mask sensitive values before they reach any logging call. " +
    "Explain the risk of sensitive data in logs and show how to scrub or mask it before logging.",

  "mass-assignment":
    "Mass assignment occurs when user-controlled fields are blindly applied to a database model without filtering — for example, spreading req.body directly into a create() call. " +
    "An attacker can add extra fields (like isAdmin: true or role: 'superuser') to the request and escalate their privileges. " +
    "Always explicitly list the fields you allow the user to set (allowlist/whitelist) and never pass req.body directly to a database call. " +
    "Explain mass assignment with a concrete example and show the safe allowlist pattern.",

  "debug-mode-in-prod":
    "Running your application in debug mode on a production server exposes full stack traces, internal file paths, and configuration details to end users. " +
    "This leaks information that helps attackers understand your app's structure and exploit other vulnerabilities. " +
    "Always set DEBUG=False (or equivalent) in production and configure a generic error page for users while logging detailed errors only server-side. " +
    "Explain why debug mode is dangerous in production and show how to disable it safely.",

  "open-redirect":
    "An open redirect lets an attacker craft a link to your site that automatically forwards the visitor to a malicious URL. " +
    "This is used in phishing: the victim clicks a link that looks legitimate (your domain) but lands on an attacker-controlled page. " +
    "Never pass user-supplied values directly to a redirect call. " +
    "Instead, validate that the redirect target matches an allowlist of safe paths, or use relative paths only (e.g. redirect('/dashboard') instead of redirect(req.query.next)). " +
    "Explain how open redirects enable phishing and show the safe allowlist fix.",

  "jwt-alg-none":
    "The JWT 'alg:none' attack exploits libraries that accept unsigned tokens when the algorithm is set to 'none'. " +
    "An attacker can forge any JWT — claiming to be any user or an admin — simply by setting the algorithm to 'none' and omitting the signature. " +
    "Always verify the JWT signature using an explicitly trusted algorithm (e.g. HS256 or RS256) and never accept 'none'. " +
    "Use a well-maintained library (like jsonwebtoken) and pass the allowed algorithms explicitly: jwt.verify(token, secret, { algorithms: ['HS256'] }). " +
    "Explain this attack and show the safe verification pattern.",

  "insecure-cookie":
    "Auth cookies missing the httpOnly, Secure, or sameSite flags are a security risk. " +
    "Without httpOnly, JavaScript on the page can read the cookie — a successful XSS attack can steal the session. " +
    "Without Secure, the cookie travels over plain HTTP where it can be intercepted. " +
    "Without sameSite=Strict or Lax, the cookie is sent on cross-site requests, enabling CSRF. " +
    "Always set all three flags for any cookie holding auth state: Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax. " +
    "Fix this by showing the corrected cookie configuration and explaining what each flag protects against.",

  "verbose-error-exposed":
    "Sending detailed error messages, stack traces, or internal exception details back to the user is a serious information leak. " +
    "Stack traces reveal your file structure, library versions, and sometimes internal logic — exactly the information an attacker needs to craft further attacks. " +
    "Always return a generic, user-friendly error message to clients ('Something went wrong') while logging the full details server-side only. " +
    "In Express, remove the default error handler and add one that sends a clean 500 response. " +
    "Explain why verbose errors are dangerous and show how to implement a safe error handler.",

  "cleartext-token-storage":
    "Storing auth tokens (JWT, access tokens, session tokens) in localStorage is risky because localStorage is accessible to any JavaScript running on the page. " +
    "If your app has even a single XSS vulnerability, an attacker can steal every token in localStorage and silently hijack user sessions. " +
    "Prefer storing auth tokens in httpOnly cookies, which JavaScript cannot access at all. " +
    "If you must use localStorage (e.g. for a non-browser client), be extra vigilant about XSS prevention. " +
    "Explain why localStorage is XSS-accessible, what an attacker can do with a stolen token, and show how to switch to httpOnly cookies.",

  "directory-listing":
    "When directory listing (autoindex) is enabled on a web server, anyone can browse the contents of any folder that lacks an index file. " +
    "This exposes source code, backup files, configuration files, and sensitive documents to the public internet. " +
    "Always disable directory listing in your server configuration. " +
    "In nginx: remove 'autoindex on'. In Apache: ensure 'Options -Indexes' is set. " +
    "Explain the risk of an exposed file listing and show how to disable it in the relevant server config.",

  "ssti":
    "Server-side template injection (SSTI) occurs when user input is embedded directly into a server-side template and rendered by the template engine. " +
    "Many template engines (Jinja2, Twig, Pebble) support expressions that can execute arbitrary code — an attacker can craft input like {{7*7}} to test for SSTI, then escalate to full remote code execution. " +
    "Never pass user-supplied strings directly to a template engine's render function. " +
    "Instead, pass user data as template variables/context and let the engine escape it: render('template.html', { name: userInput }) rather than render(userInput). " +
    "Explain SSTI with a concrete example and show the safe variable-binding fix.",
};

/**
 * Return a plain-English framing hint the lesson generator can prepend to its prompt,
 * so the generated lesson explains the RISK and how to make it safe.
 *
 * Returns a fallback string for unknown IDs so callers never need to null-check.
 */
export function riskLessonHint(conceptId: string): string {
  return (
    HINTS[conceptId] ??
    `This is a security risk. Explain why it is dangerous and how to fix it safely in plain English.`
  );
}

// The HINTS strings end with a directive aimed at the lesson *generator*
// ("Explain this risk and show…"). That tail is noise when shown directly to a
// person, so strip it for user-facing surfaces like `lumi check`.
const MODEL_DIRECTIVE_TAIL = /\.\s+(Explain|Demonstrate|Fix this by showing|Walk through)\b[\s\S]*$/;

/**
 * The same risk guidance as {@link riskLessonHint}, but cleaned for showing
 * straight to a learner: the trailing "Explain…/Demonstrate…" instruction meant
 * for the AI model is removed, leaving just the plain-English why-and-how-to-fix.
 */
export function riskAdvice(conceptId: string): string {
  const hint = HINTS[conceptId];
  if (!hint) return "This is a security risk — worth fixing before you share or ship this code.";
  return hint.replace(MODEL_DIRECTIVE_TAIL, ".").trim();
}

/** Beginner-friendly word for a severity ("danger" → "high", etc.). */
export function severityLabel(severity: Severity): string {
  return severity === "danger" ? "high" : severity === "warn" ? "medium" : "low";
}

// One short, actionable fix per risk — for the "Fix these first" list in
// `lumi audit`, where the full hint is too long and the risk *description*
// (the first sentence of the hint) is the wrong thing to show.
const RISK_FIX: Record<string, string> = {
  "hardcoded-secret": "Move the secret into a .env file (never committed) and read it via an environment variable.",
  "secret-in-frontend": "Drop the NEXT_PUBLIC_/VITE_/REACT_APP_ prefix and call the service from a server-side route instead.",
  "missing-auth": "Add an authentication check (verify a session or token) before the route runs.",
  "missing-input-validation": "Validate the input's type, length, and format before using it (e.g. with Zod).",
  "sql-injection-risk": "Use parameterized queries instead of building SQL from user input.",
  "env-file-exposed": "Add .env to .gitignore and commit a .env.example with fake values instead.",
  "plaintext-http": "Switch the URL from http:// to https://.",
  "weak-password-storage": "Hash passwords with bcrypt, Argon2, or scrypt — never plain text or MD5/SHA-1.",
  "eval-injection": "Remove eval()/new Function(); sanitize any HTML with DOMPurify before rendering.",
  "open-cors": "Replace the wildcard origin (*) with an allowlist of the specific domains you trust.",
  "xss": "Escape or sanitize user content (e.g. DOMPurify) instead of setting innerHTML directly.",
  "csrf": "Protect state-changing routes with a CSRF token or SameSite cookies.",
  "path-traversal": "Resolve the path and confirm it stays inside the intended base directory before opening it.",
  "ssrf": "Allowlist the schemes and hostnames your server is allowed to fetch.",
  "idor": "Check the logged-in user owns the resource before returning it.",
  "insecure-deserialization": "Don't deserialize untrusted data with powerful serializers; use schema-validated JSON.",
  "missing-rate-limit": "Add rate limiting to login and other sensitive endpoints (e.g. express-rate-limit).",
  "default-credentials": "Change every default password to a strong, unique one right after setup.",
  "sensitive-data-in-logs": "Redact passwords, tokens, and personal data before anything reaches a logging call.",
  "mass-assignment": "Allowlist the fields users may set instead of passing the whole request body to the database.",
  "debug-mode-in-prod": "Turn debug mode off in production and show users a generic error page.",
  "open-redirect": "Only redirect to an allowlist of safe paths, never to a user-supplied URL.",
  "jwt-alg-none": "Verify JWTs with an explicit algorithm such as HS256 and reject 'none'.",
  "insecure-cookie": "Set HttpOnly, Secure, and SameSite on any cookie that holds auth state.",
  "verbose-error-exposed": "Return a generic error to users and log the full details server-side only.",
  "cleartext-token-storage": "Store auth tokens in HttpOnly cookies rather than localStorage.",
  "directory-listing": "Disable directory listing (nginx: remove autoindex; Apache: Options -Indexes).",
  "ssti": "Pass user input as template variables — never build the template string from it.",
};

/**
 * One short, imperative fix for a risk, suitable for a prioritized "do this first"
 * list. Falls back to a safe generic action for unknown ids.
 */
export function riskFix(conceptId: string): string {
  return RISK_FIX[conceptId] ?? "Review this with someone you trust and fix it before you ship.";
}
